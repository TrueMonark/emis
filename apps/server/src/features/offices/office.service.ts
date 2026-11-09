import { transferService } from "@/features/transfers/transfer.service";
import { normalizeZambianPhone } from "@school/shared/auth/sign-in-id";
import { authRepository } from "@/features/auth/auth.repository";
import { signInPhoneFor } from "@/features/auth/sign-in-phone";
import type { EducationOfficeType, OfficeRole, Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { issueOneTimePassword } from "@/features/auth/one-time-password";
import { auditService } from "@/features/audit/audit.service";
import { logger } from "@/lib/logger/logger";
import { officeRepository } from "./office.repository";
import type {
  CreateOfficeAccountInput,
  CreateSchoolInput,
  UpdateSchoolInput,
} from "./office.validation";

/** The signed-in office person (from withAuth on /api/office/* routes). */
export interface OfficeContext {
  userId: string;
  office: {
    membershipId: string;
    officeId: string;
    officeType: EducationOfficeType;
    role: OfficeRole;
  };
}

/** The placeholder district for schools whose district isn't known yet (Phase 3a migration). */
export const UNASSIGNED_DISTRICT_ID = "office-district-unassigned";
export const UNASSIGNED_PROVINCE_ID = "office-prov-unassigned";

const OFFICE_LABEL: Record<EducationOfficeType, string> = {
  HQ: "Ministry headquarters",
  PROVINCIAL: "Provincial Education Office",
  DISTRICT: "District Education Board Secretary's office",
};

/**
 * The account chain (Phase 4a). What each office may see and do:
 *
 * | Office | Sees                                   | Its head can                                   |
 * |--------|----------------------------------------|------------------------------------------------|
 * | HQ     | every office and school                | create accounts anywhere; add districts; move schools between districts |
 * | PEO    | its province's districts and schools   | create DEBS accounts and add districts in its province; move schools within it |
 * | DEBS   | its district's schools                 | register schools in its district with their first head teacher; manage EMIS numbers |
 *
 * Officers (OFFICER) see the same as their head but change nothing. Within its own office a head
 * adds officers only; heads of an office are created from the level above (HQ for HQ).
 */
export class OfficeService {
  // ── Scope ──────────────────────────────────────────────────────────────────────────────

  private requireHead(ctx: OfficeContext) {
    if (ctx.office.role !== "OFFICE_HEAD") {
      throw new UnauthorizedError("Only the head of the office can make changes");
    }
  }

  /** Offices this office can see: "ALL" for HQ. */
  async officeIdsInScope(ctx: OfficeContext): Promise<string[] | "ALL"> {
    if (ctx.office.officeType === "HQ") return "ALL";
    if (ctx.office.officeType === "PROVINCIAL") {
      const children = await prisma.educationOffice.findMany({
        where: { parentId: ctx.office.officeId },
        select: { id: true },
      });
      return [ctx.office.officeId, ...children.map((c) => c.id)];
    }
    return [ctx.office.officeId];
  }

  schoolWhere(ctx: OfficeContext): Prisma.SchoolWhereInput {
    if (ctx.office.officeType === "HQ") return {};
    if (ctx.office.officeType === "PROVINCIAL") return { districtOffice: { parentId: ctx.office.officeId } };
    return { districtOfficeId: ctx.office.officeId };
  }

  /** Every active school under an office (what a return round or announcement from it reaches). */
  schoolsUnderOfficeWhere(office: { id: string; type: EducationOfficeType | string }): Prisma.SchoolWhereInput {
    if (office.type === "HQ") return {};
    if (office.type === "PROVINCIAL") return { districtOffice: { parentId: office.id } };
    return { districtOfficeId: office.id };
  }

  /**
   * Offices whose rounds and announcements this office sees: those in its area (all for HQ) and
   * those above it (whose messages reach its schools).
   */
  async messageOfficeIdsFor(ctx: OfficeContext): Promise<string[] | "ALL"> {
    const inScope = await this.officeIdsInScope(ctx);
    if (inScope === "ALL") return "ALL";
    const above: string[] = [];
    let id: string | null = ctx.office.officeId;
    while (id && above.length < 5) {
      above.push(id);
      const office: { parentId: string | null } | null = await prisma.educationOffice.findUnique({
        where: { id },
        select: { parentId: true },
      });
      id = office?.parentId ?? null;
    }
    return [...new Set([...inScope, ...above])];
  }

  /** Offices whose rounds and announcements reach a school: its district, its province, HQ. */
  async messageOfficeIdsForSchool(schoolId: string): Promise<string[]> {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { districtOfficeId: true, districtOffice: { select: { parentId: true } } },
    });
    if (!school) throw new NotFoundError("School not found");
    const hq = await prisma.educationOffice.findMany({ where: { type: "HQ" }, select: { id: true } });
    return [
      ...new Set([school.districtOfficeId, ...(school.districtOffice.parentId ? [school.districtOffice.parentId] : []), ...hq.map((o) => o.id)]),
    ];
  }

  /** Active schools in this office's area, with their district (for progress tables). */
  schoolsInScopeForProgress(ctx: OfficeContext) {
    return prisma.school.findMany({
      where: { ...this.schoolWhere(ctx), status: "ACTIVE" },
      select: { id: true, name: true, districtOffice: { select: { name: true } } },
      orderBy: [{ districtOffice: { name: "asc" } }, { name: "asc" }],
    });
  }

  /** Whether the school is in this office's area (its district, province, or anywhere for HQ). */
  async isSchoolInScope(ctx: OfficeContext, schoolId: string): Promise<boolean> {
    return (await prisma.school.count({ where: { id: schoolId, ...this.schoolWhere(ctx) } })) > 0;
  }

  private async schoolIdsInScope(ctx: OfficeContext): Promise<string[] | "ALL"> {
    if (ctx.office.officeType === "HQ") return "ALL";
    const schools = await prisma.school.findMany({ where: this.schoolWhere(ctx), select: { id: true } });
    return schools.map((s) => s.id);
  }

  /** Whether this office's head may create or end accounts at `target` with `role`. */
  private canManageAccountsAt(
    ctx: OfficeContext,
    target: { id: string; type: EducationOfficeType; parentId: string | null },
    role: OfficeRole
  ): boolean {
    if (ctx.office.role !== "OFFICE_HEAD") return false;
    if (ctx.office.officeType === "HQ") return true;
    if (target.id === ctx.office.officeId) return role === "OFFICER";
    // A PEO manages its own districts' offices (DEBS heads and officers).
    return (
      ctx.office.officeType === "PROVINCIAL" &&
      target.type === "DISTRICT" &&
      target.parentId === ctx.office.officeId
    );
  }

  // ── My office ─────────────────────────────────────────────────────────────────────────

  async getMyOffice(ctx: OfficeContext) {
    const office = await prisma.educationOffice.findUniqueOrThrow({
      where: { id: ctx.office.officeId },
      select: {
        id: true,
        type: true,
        name: true,
        code: true,
        parent: { select: { id: true, name: true } },
      },
    });
    const officeIds = await this.officeIdsInScope(ctx);
    const [schools, schoolsInSetup, childOffices, accounts] = await Promise.all([
      prisma.school.count({ where: this.schoolWhere(ctx) }),
      prisma.school.count({ where: { ...this.schoolWhere(ctx), setupCompletedAt: null } }),
      prisma.educationOffice.count({
        where: officeIds === "ALL" ? { type: { not: "HQ" } } : { id: { in: officeIds.filter((i) => i !== office.id) } },
      }),
      prisma.officeMembership.count({
        where: { status: "ACTIVE", ...(officeIds === "ALL" ? {} : { officeId: { in: officeIds } }) },
      }),
    ]);
    return {
      office: { ...office, label: OFFICE_LABEL[office.type] },
      role: ctx.office.role,
      counts: { schools, schoolsInSetup, childOffices, accounts },
    };
  }

  // ── Offices ───────────────────────────────────────────────────────────────────────────

  async listOffices(ctx: OfficeContext) {
    const ids = await this.officeIdsInScope(ctx);
    return officeRepository.findOffices(ids === "ALL" ? {} : { id: { in: ids } });
  }

  /** Add a district office (the official list isn't loaded yet; offices add their own). */
  async createDistrictOffice(ctx: OfficeContext, input: { name: string; code?: string | null; parentId?: string | null }) {
    this.requireHead(ctx);
    let parentId: string;
    if (ctx.office.officeType === "PROVINCIAL") {
      parentId = ctx.office.officeId;
    } else if (ctx.office.officeType === "HQ") {
      if (!input.parentId) throw new ValidationError("Choose the province the district belongs to");
      const parent = await officeRepository.findOffice(input.parentId);
      if (!parent || parent.type !== "PROVINCIAL") throw new ValidationError("Choose a province");
      parentId = parent.id;
    } else {
      throw new UnauthorizedError("Only HQ or a provincial office can add district offices");
    }
    const code = input.code?.trim().toUpperCase() || null;
    if (code && (await officeRepository.findCodeTaken(code))) {
      throw new ConflictError(`Office code ${code} is already used`);
    }
    const office = await officeRepository.createOffice({ type: "DISTRICT", name: input.name, code, parentId });
    await auditService.record({
      action: "OFFICE_CREATED",
      targetType: "OFFICE",
      targetId: office.id,
      officeId: office.id,
      summary: `Added district office "${office.name}"`,
      details: { parentId },
    });
    return office;
  }

  async updateOffice(ctx: OfficeContext, id: string, input: { name?: string; code?: string | null; isActive?: boolean }) {
    this.requireHead(ctx);
    const office = await officeRepository.findOffice(id);
    if (!office) throw new NotFoundError("Office not found");
    const allowed =
      ctx.office.officeType === "HQ"
        ? office.type !== "HQ" || input.isActive === undefined
        : ctx.office.officeType === "PROVINCIAL" && office.type === "DISTRICT" && office.parentId === ctx.office.officeId;
    if (!allowed) throw new UnauthorizedError("You can't change that office");
    if (id === "office-district-unassigned" || id === UNASSIGNED_PROVINCE_ID) {
      throw new ValidationError("The 'not yet assigned' placeholders can't be changed");
    }
    const code = input.code === undefined ? undefined : input.code?.trim().toUpperCase() || null;
    if (code && (await officeRepository.findCodeTaken(code, id))) {
      throw new ConflictError(`Office code ${code} is already used`);
    }
    const updated = await officeRepository.updateOffice(id, { name: input.name, code, isActive: input.isActive });
    await auditService.record({
      action: "OFFICE_UPDATED",
      targetType: "OFFICE",
      targetId: id,
      officeId: id,
      summary: `Updated office "${updated.name}"`,
      details: { before: { name: office.name, code: office.code, isActive: office.isActive }, after: input },
    });
    return updated;
  }

  // ── Accounts ──────────────────────────────────────────────────────────────────────────

  async listAccounts(ctx: OfficeContext) {
    const ids = await this.officeIdsInScope(ctx);
    const officeIds =
      ids === "ALL" ? (await prisma.educationOffice.findMany({ select: { id: true } })).map((o) => o.id) : ids;
    return officeRepository.findAccounts(officeIds);
  }

  /**
   * Create an office account with a one-time password (shown once, here), or add an office role
   * to an existing account that has no current school or office role (e.g. a former teacher).
   */
  async createAccount(ctx: OfficeContext, input: CreateOfficeAccountInput) {
    const target = await officeRepository.findOffice(input.officeId);
    if (!target || !target.isActive) throw new NotFoundError("Office not found");
    if (!this.canManageAccountsAt(ctx, target, input.role)) {
      throw new UnauthorizedError(
        input.role === "OFFICE_HEAD" && target.id === ctx.office.officeId
          ? "Heads of an office are created by the office above it"
          : "You can't create accounts for that office"
      );
    }

    const phone = input.phone ? normalizeZambianPhone(input.phone) : null;
    if (phone) {
      const owner = await authRepository.findUserIdByPhone(phone);
      const sameEmail = owner ? await officeRepository.findUserByEmail(input.email) : null;
      if (owner && sameEmail?.id !== owner) {
        throw new ConflictError("That mobile number is already used to sign in to another account");
      }
    }

    const existing = await officeRepository.findUserByEmail(input.email);
    if (existing) {
      if (phone) await authRepository.setPhone(existing.id, phone);
      if (existing.officeMemberships.length > 0 || existing.schoolMemberships.length > 0) {
        throw new ConflictError(
          "That email already belongs to someone working at a school or office. Moving people between them comes with transfers."
        );
      }
      const membership = await prisma.officeMembership.upsert({
        where: { userId_officeId: { userId: existing.id, officeId: target.id } },
        update: { status: "ACTIVE", role: input.role, title: input.title ?? null, endDate: null, startDate: new Date() },
        create: { userId: existing.id, officeId: target.id, role: input.role, title: input.title ?? null },
      });
      await this.auditAccount(target, membership.id, input, true);
      return { membershipId: membership.id, email: input.email, existingAccount: true, temporaryPassword: null };
    }

    const otp = await issueOneTimePassword();
    const user = await officeRepository.createAccount({
      email: input.email,
      phone,
      displayName: input.displayName,
      passwordHash: otp.passwordHash,
      expiresAt: otp.expiresAt,
      officeId: target.id,
      role: input.role,
      title: input.title ?? null,
    });
    await this.auditAccount(target, user.officeMemberships[0].id, input, false);
    return {
      membershipId: user.officeMemberships[0].id,
      email: user.email,
      existingAccount: false,
      temporaryPassword: otp.password,
      temporaryPasswordExpiresAt: otp.expiresAt.toISOString(),
    };
  }

  private async auditAccount(
    target: { id: string; name: string },
    membershipId: string,
    input: CreateOfficeAccountInput,
    existing: boolean
  ) {
    await auditService.record({
      action: "ACCOUNT_CREATED",
      targetType: "ACCOUNT",
      targetId: membershipId,
      officeId: target.id,
      summary: `${existing ? "Gave existing account" : "Created account for"} ${input.displayName} (${input.email}) as ${
        input.role === "OFFICE_HEAD" ? "head" : "officer"
      } of ${target.name}`,
    });
  }

  async endAccount(ctx: OfficeContext, membershipId: string) {
    const membership = await officeRepository.findMembershipById(membershipId);
    if (!membership || membership.status !== "ACTIVE") throw new NotFoundError("Account not found");
    if (membershipId === ctx.office.membershipId) {
      throw new ValidationError("You can't end your own office role");
    }
    const target = await officeRepository.findOffice(membership.officeId);
    if (!target || !this.canManageAccountsAt(ctx, target, membership.role)) {
      throw new UnauthorizedError("You can't change accounts at that office");
    }
    await officeRepository.endMembership(membershipId);
    await auditService.record({
      action: "MEMBERSHIP_ENDED",
      targetType: "ACCOUNT",
      targetId: membershipId,
      officeId: target.id,
      summary: `Ended ${membership.user.displayName ?? membership.user.email}'s role at ${target.name}`,
    });
  }

  // ── Schools ───────────────────────────────────────────────────────────────────────────

  async listSchools(ctx: OfficeContext, search?: string | null) {
    const q = search?.trim();
    return officeRepository.findSchools({
      ...this.schoolWhere(ctx),
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { emisNumber: { contains: q, mode: "insensitive" } }] }
        : {}),
    });
  }

  /**
   * A DEBS registers a school in its own district together with its first head teacher. The
   * head gets a one-time password (shown once, here) and, after choosing their own password,
   * the school's setup wizard.
   */
  async createSchool(ctx: OfficeContext, input: CreateSchoolInput) {
    this.requireHead(ctx);
    if (ctx.office.officeType !== "DISTRICT") {
      throw new UnauthorizedError("Schools are registered by the district office (DEBS)");
    }
    if (ctx.office.officeId === UNASSIGNED_DISTRICT_ID) {
      throw new ValidationError("Schools can't be registered in the 'not yet assigned' district");
    }
    const emisNumber = input.emisNumber?.trim() || null;
    if (emisNumber) {
      const clash = await officeRepository.findSchoolByEmis(emisNumber);
      if (clash) throw new ConflictError(`EMIS number ${emisNumber} is already used by ${clash.name}`);
    }
    if (input.head.kind === "existing") {
      return this.createSchoolWithExistingHead(ctx, input, input.head.existingUserId, emisNumber);
    }
    const newHead = input.head;
    const headEmail = newHead.email;
    if (await officeRepository.findUserByEmail(headEmail)) {
      throw new ConflictError(
        "That email already has an account. Choose \"An existing person\" and find them by email or mobile number instead."
      );
    }
    // Staff numbers are unique nationally; profiles at other schools aren't visible here, so the
    // database's unique rule is the check (turned into a clear message below).

    const school = await officeRepository.createSchool({
      name: input.name,
      emisNumber,
      category: input.category,
      agency: input.agency?.trim() || null,
      districtOfficeId: ctx.office.officeId,
    });

    const otp = await issueOneTimePassword();
    const phone = normalizeZambianPhone(newHead.phone) ?? newHead.phone;
    const signInPhone = await signInPhoneFor(phone);
    try {
      // The head's profile is written in the new school's context (teacher profiles are only
      // visible to the person and their schools).
      const head = await runWithTenant({ schoolId: school.id, userId: ctx.userId }, () =>
        prisma.teacherProfile.create({
          data: {
            staffNumber: newHead.staffNumber,
            firstName: newHead.firstName,
            lastName: newHead.lastName,
            dateOfBirth: newHead.dateOfBirth,
            gender: newHead.gender,
            phone,
            qualification: newHead.qualification,
            hireDate: new Date(),
            user: {
              create: {
                email: headEmail,
                phone: signInPhone,
                displayName: `${newHead.firstName} ${newHead.lastName}`,
                passwordHash: otp.passwordHash,
                role: "HEAD_TEACHER",
                hasDefaultPassword: true,
                temporaryPasswordExpiresAt: otp.expiresAt,
                schoolMemberships: { create: { schoolId: school.id, role: "HEAD_TEACHER" } },
              },
            },
          },
          select: { id: true, userId: true },
        })
      );

      await auditService.record({
        action: "SCHOOL_CREATED",
        targetType: "SCHOOL",
        targetId: school.id,
        schoolId: school.id,
        officeId: ctx.office.officeId,
        summary: `Registered ${school.name}${emisNumber ? ` (EMIS ${emisNumber})` : ""} with head teacher ${newHead.firstName} ${newHead.lastName}`,
        details: { headUserId: head.userId, headEmail },
      });

      return {
        school,
        head: { email: headEmail, name: `${newHead.firstName} ${newHead.lastName}` },
        temporaryPassword: otp.password,
        temporaryPasswordExpiresAt: otp.expiresAt.toISOString(),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        await officeRepository.deleteSchool(school.id).catch(() => undefined);
        // The database doesn't always say which field clashed (driver adapters report "not
        // available"). The email was checked above, so unless it was taken in the meantime,
        // the clash is the staff number (unique nationally, other schools' profiles not visible).
        if (await officeRepository.findUserByEmail(headEmail)) {
          throw new ConflictError("That email already has an account; use another email for now.");
        }
        throw new ConflictError(`Staff number ${newHead.staffNumber} is already used`);
      }
      // Don't leave a school without its head behind.
      await officeRepository.deleteSchool(school.id).catch((e) =>
        logger.error("Could not remove half-created school", e instanceof Error ? e : undefined, { schoolId: school.id })
      );
      throw error;
    }
  }

  /**
   * A new school whose first head already has an account (e.g. a deputy promoted to head of a
   * new school). Their account and password stay theirs. If they work at another school now,
   * it's a transfer: PENDING until that school or the office over it confirms. Otherwise they
   * start straight away.
   */
  private async createSchoolWithExistingHead(
    ctx: OfficeContext,
    input: CreateSchoolInput,
    userId: string,
    emisNumber: string | null
  ) {
    const { person } = await transferService.assertCanJoin(userId, null);
    const school = await officeRepository.createSchool({
      name: input.name,
      emisNumber,
      category: input.category,
      agency: input.agency?.trim() || null,
      districtOfficeId: ctx.office.officeId,
    });
    const name = person.profile ? `${person.profile.firstName} ${person.profile.lastName}` : person.email;
    try {
      const joined = await transferService.addExistingPerson(school.id, userId, "HEAD_TEACHER", ctx.userId, {
        officeId: ctx.office.officeId,
      });
      await auditService.record({
        action: "SCHOOL_CREATED",
        targetType: "SCHOOL",
        targetId: school.id,
        schoolId: school.id,
        officeId: ctx.office.officeId,
        summary: `Registered ${school.name}${emisNumber ? ` (EMIS ${emisNumber})` : ""} with head teacher ${name} (existing account${
          joined.status === "PENDING" ? `, transfer from ${joined.fromSchool} waiting for confirmation` : ""
        })`,
        details: { headUserId: userId },
      });
      return {
        school,
        head: { email: person.email, name },
        headStatus: joined.status,
        temporaryPassword: null,
        temporaryPasswordExpiresAt: null,
      };
    } catch (error) {
      await officeRepository.deleteSchool(school.id).catch((e) =>
        logger.error("Could not remove half-created school", e instanceof Error ? e : undefined, { schoolId: school.id })
      );
      throw error;
    }
  }

  private async findSchoolInScope(ctx: OfficeContext, id: string) {
    const school = await officeRepository.findSchool(id);
    if (!school) throw new NotFoundError("School not found");
    const inScope =
      ctx.office.officeType === "HQ" ||
      (ctx.office.officeType === "PROVINCIAL" &&
        (school.districtOffice.parentId === ctx.office.officeId || school.districtOfficeId === UNASSIGNED_DISTRICT_ID)) ||
      (ctx.office.officeType === "DISTRICT" && school.districtOfficeId === ctx.office.officeId);
    if (!inScope) throw new NotFoundError("School not found");
    return school;
  }

  /** Name, EMIS number and status, category. Only the DEBS (or above) changes these. */
  async updateSchool(ctx: OfficeContext, id: string, input: UpdateSchoolInput) {
    this.requireHead(ctx);
    const school = await this.findSchoolInScope(ctx, id);
    const emisNumber = input.emisNumber === undefined ? undefined : input.emisNumber?.trim() || null;
    if (emisNumber) {
      const clash = await officeRepository.findSchoolByEmis(emisNumber, id);
      if (clash) throw new ConflictError(`EMIS number ${emisNumber} is already used by ${clash.name}`);
    }
    // School fees: always on for a private school; the office can switch them on for others.
    const category = input.category ?? school.category;
    const feesEnabled = category === "PRIVATE" ? true : input.feesEnabled;
    const updated = await officeRepository.updateSchool(id, {
      ...(feesEnabled !== undefined && { feesEnabled }),
      ...(input.name !== undefined && { name: input.name }),
      ...(emisNumber !== undefined && { emisNumber }),
      ...(input.emisStatus !== undefined && { emisStatus: input.emisStatus }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.agency !== undefined && { agency: input.agency?.trim() || null }),
      ...(input.status !== undefined && { status: input.status }),
    });
    await auditService.record({
      action: "SCHOOL_UPDATED",
      targetType: "SCHOOL",
      targetId: id,
      schoolId: id,
      officeId: ctx.office.officeId,
      summary: `Updated ${updated.name}${
        emisNumber !== undefined && emisNumber !== school.emisNumber
          ? `: EMIS ${school.emisNumber ?? "none"} → ${emisNumber ?? "none"}`
          : ""
      }`,
      details: { before: { name: school.name, emisNumber: school.emisNumber, emisStatus: school.emisStatus }, after: input },
    });
    return updated;
  }

  /** Move a school to its right district (e.g. out of "not yet assigned"). HQ, or a PEO in its province. */
  async moveSchool(ctx: OfficeContext, id: string, districtOfficeId: string) {
    this.requireHead(ctx);
    if (ctx.office.officeType === "DISTRICT") {
      throw new UnauthorizedError("A school's district is changed by the provincial office or HQ");
    }
    const school = await this.findSchoolInScope(ctx, id);
    const district = await officeRepository.findOffice(districtOfficeId);
    if (!district || district.type !== "DISTRICT" || !district.isActive) {
      throw new ValidationError("Choose an active district office");
    }
    if (ctx.office.officeType === "PROVINCIAL" && district.parentId !== ctx.office.officeId) {
      throw new UnauthorizedError("That district isn't in your province");
    }
    const updated = await officeRepository.updateSchool(id, { districtOfficeId });
    await auditService.record({
      action: "SCHOOL_MOVED",
      targetType: "SCHOOL",
      targetId: id,
      schoolId: id,
      officeId: districtOfficeId,
      summary: `Moved ${updated.name} to ${district.name}`,
      details: { from: school.districtOfficeId, to: districtOfficeId },
    });
    return updated;
  }

  // ── Audit ─────────────────────────────────────────────────────────────────────────────

  async listAudit(ctx: OfficeContext) {
    const [officeIds, schoolIds] = await Promise.all([this.officeIdsInScope(ctx), this.schoolIdsInScope(ctx)]);
    return auditService.list({ officeIds, schoolIds });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2002";
}

export const officeService = new OfficeService();

/** The office context of an /api/office/* request (withAuth sets user.office there). */
export function officeContextOf(user: {
  userId: string;
  office?: OfficeContext["office"];
}): OfficeContext {
  if (!user.office) throw new UnauthorizedError("These pages are for education office staff");
  return { userId: user.userId, office: user.office };
}
