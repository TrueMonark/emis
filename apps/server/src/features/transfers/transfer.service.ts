import { z } from "zod";
import type { Role } from "@prisma/client";
import { parseSignInId } from "@school/shared/auth/sign-in-id";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { runWithTenant } from "@/lib/db/tenant";
import { logger } from "@/lib/logger/logger";
import { auditService } from "@/features/audit/audit.service";
import { officeService, type OfficeContext } from "@/features/offices/office.service";
import { transferRepository, type PendingTransfer } from "./transfer.repository";

/** Roles a school can give someone joining it. */
export const JOINING_ROLES = ["TEACHER", "CLERK", "DEPUTY_HEAD", "HEAD_TEACHER"] as const;

export const requestTransferSchema = z.object({
  userId: z.string().min(1, "Find the person first"),
  role: z.enum(JOINING_ROLES),
});
export type RequestTransferInput = z.infer<typeof requestTransferSchema>;

export interface SchoolLeaderContext {
  kind: "school";
  userId: string;
  role: string;
  schoolId: string;
}
export interface OfficeHeadContext {
  kind: "office";
  ctx: OfficeContext;
}
export type TransferActor = SchoolLeaderContext | OfficeHeadContext;

/**
 * Transfers (design §3 and decision 1): one account for life, at most one school at a time.
 *
 *  1. The new school's head/deputy finds the person by their exact email or mobile number (no
 *     browsing of other schools' staff) and asks for them. That's a PENDING membership: the
 *     person keeps working at their current school until it's confirmed.
 *  2. The old school's head/deputy, or the education office over the old school, confirms
 *     (or turns it down). The new school can withdraw it while it waits.
 *  3. On confirmation, at the same moment: the old membership ends, the new one becomes ACTIVE,
 *     and the old school's class-teacher and subject assignments are released for its head to
 *     reassign. The teacher profile (qualifications, staff number) moves with the person.
 *
 * Someone with no current school (left teaching, now returning) joins straight away.
 */
export class TransferService {
  private requireLeader(actor: SchoolLeaderContext) {
    if (!isSchoolLeader(actor.role)) {
      throw new ForbiddenError("Only the head teacher or deputy head handles staff transfers");
    }
  }

  /** Find one person by exact email or mobile number, for "Add existing staff". */
  async lookup(actor: SchoolLeaderContext | OfficeHeadContext, typed: string) {
    if (actor.kind === "school") this.requireLeader(actor);
    else if (actor.ctx.office.role !== "OFFICE_HEAD") throw new ForbiddenError("Only the head of the office can do this");

    const id = parseSignInId(typed);
    if (!id) throw new ValidationError("Enter their full email address or mobile number");
    const person =
      id.kind === "email" ? await transferRepository.findUserByEmail(id.value) : await transferRepository.findUserByPhone(id.value);
    if (!person || !person.isActive) return null;

    const memberships = await transferRepository.findCurrentMemberships(person.id);
    const active = memberships.find((m) => m.status === "ACTIVE");
    const pending = memberships.find((m) => m.status === "PENDING");
    return {
      userId: person.id,
      name: nameOf(person),
      staffNumber: person.profile?.staffNumber ?? null,
      hasStaffProfile: !!person.profile,
      currentSchool: active ? { name: active.school.name, isThisSchool: actor.kind === "school" && active.schoolId === actor.schoolId } : null,
      pendingTransferTo: pending ? pending.school.name : null,
    };
  }

  /** Checks shared by "add existing staff" and "appoint an existing person as head". */
  async assertCanJoin(userId: string, schoolId: string | null) {
    const person = await transferRepository.findUser(userId);
    if (!person || !person.isActive) throw new NotFoundError("Person not found");
    if (!person.profile) {
      throw new ValidationError(`${nameOf(person)} has no staff profile (an education office account). They can't be added to a school's staff.`);
    }
    const memberships = await transferRepository.findCurrentMemberships(userId);
    const here = memberships.find((m) => m.schoolId === schoolId);
    if (here?.status === "ACTIVE") throw new ConflictError(`${nameOf(person)} already works at this school`);
    if (here?.status === "PENDING") throw new ConflictError(`${nameOf(person)}'s transfer here is already waiting for confirmation`);
    const pendingElsewhere = memberships.find((m) => m.status === "PENDING");
    if (pendingElsewhere) {
      throw new ConflictError(`${nameOf(person)} already has a transfer waiting (to ${pendingElsewhere.school.name})`);
    }
    return { person, active: memberships.find((m) => m.status === "ACTIVE") ?? null };
  }

  /**
   * Ask for an existing person to join `schoolId` with `role`. PENDING while they work at
   * another school (that school or the DEBS confirms); straight away if they have no school.
   */
  async addExistingPerson(schoolId: string, userId: string, role: Role, requestedById: string, requestedFrom: { officeId?: string } = {}) {
    const { person, active } = await this.assertCanJoin(userId, schoolId);
    const name = nameOf(person);

    if (!active) {
      await transferRepository.joinNow({ userId, schoolId, role, requestedById });
      await auditService.record({
        action: "STAFF_JOINED",
        targetType: "ACCOUNT",
        targetId: userId,
        schoolId,
        officeId: requestedFrom.officeId ?? null,
        summary: `${name} joined as ${roleLabel(role)} (no current school, so no transfer to confirm)`,
        actorUserId: requestedById,
      });
      return { status: "ACTIVE" as const, name };
    }

    const pending = await transferRepository.upsertPending({ userId, schoolId, role, requestedById });
    await auditService.record({
      action: "TRANSFER_REQUESTED",
      targetType: "ACCOUNT",
      targetId: userId,
      schoolId,
      officeId: active.school.districtOfficeId,
      summary: `Asked for ${name} to transfer from ${active.school.name} to ${pending.school.name} as ${roleLabel(role)}`,
      details: { membershipId: pending.id, fromSchoolId: active.schoolId },
      actorUserId: requestedById,
    });
    await this.notifySchoolLeaders(
      active.schoolId,
      requestedById,
      userId,
      `Transfer request: ${name}`,
      `${pending.school.name} has asked for ${name} to transfer there as ${roleLabel(role)}. Open Teachers → "Transfers" to confirm or turn it down. Until then ${name} keeps working here.`,
      pending.id
    );
    return { status: "PENDING" as const, name, fromSchool: active.school.name };
  }

  /** "Add existing staff" on the Teachers page (the receiving school's head or deputy). */
  async request(actor: SchoolLeaderContext, input: RequestTransferInput) {
    this.requireLeader(actor);
    return this.addExistingPerson(actor.schoolId, input.userId, input.role as Role, actor.userId);
  }

  /** Transfers in and out of the actor's school, or (offices) touching schools in their area. */
  async list(actor: TransferActor) {
    let schoolIds: string[] | "ALL";
    if (actor.kind === "school") {
      this.requireLeader(actor);
      schoolIds = [actor.schoolId];
    } else {
      schoolIds = await this.officeSchoolIds(actor.ctx);
    }
    const rows = await transferRepository.findPendingTouching(schoolIds);
    const inArea = (id: string | undefined) => !!id && (schoolIds === "ALL" || schoolIds.includes(id));
    const actives = await transferRepository.findActiveSchoolOf(rows.map((r) => r.userId));
    const names = await transferRepository.findUserNames([...new Set(rows.map((r) => r.requestedById).filter((x): x is string => !!x))]);
    return rows.map((r) => {
      const from = actives.find((a) => a.userId === r.userId) ?? null;
      const requester = names.find((n) => n.id === r.requestedById);
      return {
        id: r.id,
        userId: r.userId,
        name: nameOf(r.user),
        staffNumber: r.user.profile?.staffNumber ?? null,
        role: r.role,
        requestedAt: r.requestedAt,
        requestedBy: requester ? requester.displayName || requester.email : null,
        toSchool: { id: r.school.id, name: r.school.name },
        fromSchool: from ? { id: from.school.id, name: from.school.name } : null,
        direction:
          actor.kind === "school"
            ? r.schoolId === actor.schoolId
              ? ("in" as const)
              : ("out" as const)
            : null,
        /** Whether this actor may confirm / turn it down (the old school, or the office over it) */
        canDecide:
          actor.kind === "school"
            ? r.schoolId !== actor.schoolId && r.userId !== actor.userId
            : actor.ctx.office.role === "OFFICE_HEAD" && (from ? inArea(from.schoolId) : inArea(r.schoolId)),
      };
    });
  }

  private async officeSchoolIds(ctx: OfficeContext): Promise<string[] | "ALL"> {
    if (ctx.office.officeType === "HQ") return "ALL";
    return (await officeService.listSchools(ctx)).map((s: { id: string }) => s.id);
  }

  /** The waiting transfer and the person's current membership, if this actor may decide it. */
  private async decidable(id: string, actor: TransferActor) {
    const pending = await transferRepository.findPending(id);
    if (!pending) throw new NotFoundError("Transfer not found (it may have been confirmed or withdrawn)");
    const [current] = await transferRepository.findActiveSchoolOf([pending.userId]);

    if (actor.kind === "school") {
      this.requireLeader(actor);
      if (!current || current.schoolId !== actor.schoolId) throw new NotFoundError("Transfer not found");
      if (pending.userId === actor.userId) {
        throw new ForbiddenError("Your own transfer is confirmed by your deputy/head teacher or the district office");
      }
    } else {
      if (actor.ctx.office.role !== "OFFICE_HEAD") throw new ForbiddenError("Only the head of the office can confirm transfers");
      const inScope =
        (current && (await officeService.isSchoolInScope(actor.ctx, current.schoolId))) ||
        (!current && (await officeService.isSchoolInScope(actor.ctx, pending.schoolId)));
      if (!inScope) throw new NotFoundError("Transfer not found");
    }
    return { pending, current };
  }

  /** Confirm: the person moves over completely, now. */
  async confirm(id: string, actor: TransferActor) {
    const { pending, current } = await this.decidable(id, actor);
    const actorId = actor.kind === "school" ? actor.userId : actor.ctx.userId;
    const name = nameOf(pending.user);

    if (!current) {
      // Their old membership ended in the meantime: nothing to release, they just join.
      await transferRepository.joinNow({ userId: pending.userId, schoolId: pending.schoolId, role: pending.role, requestedById: pending.requestedById ?? actorId });
      return { confirmed: true, released: null };
    }

    const released = await runWithTenant({ schoolId: current.schoolId, userId: actorId }, () =>
      transferRepository.confirm({
        oldMembershipId: current.id,
        pendingId: pending.id,
        userId: pending.userId,
        role: pending.role,
        teacherProfileId: pending.user.profile?.id ?? null,
        confirmedById: actorId,
      })
    );

    await auditService.record({
      action: "TRANSFER_CONFIRMED",
      targetType: "ACCOUNT",
      targetId: pending.userId,
      schoolId: pending.schoolId,
      officeId: current.school.districtOfficeId,
      summary: `Confirmed ${name}'s transfer from ${current.school.name} to ${pending.school.name}`,
      details: { membershipId: pending.id, fromSchoolId: current.schoolId, released },
      actorUserId: actorId,
    });
    await this.notifySchoolLeaders(
      pending.schoolId,
      actorId,
      pending.userId,
      `Transfer confirmed: ${name}`,
      `${name}'s transfer from ${current.school.name} has been confirmed. They now work at ${pending.school.name} as ${roleLabel(pending.role)}. Give them their classes and subjects on the Teachers and Classes pages.`,
      pending.id,
      true
    );
    return { confirmed: true, released };
  }

  /** Turn down (old school or office): the person stays where they are. */
  async decline(id: string, actor: TransferActor) {
    const { pending, current } = await this.decidable(id, actor);
    const actorId = actor.kind === "school" ? actor.userId : actor.ctx.userId;
    await transferRepository.dropPending(pending);
    await auditService.record({
      action: "TRANSFER_DECLINED",
      targetType: "ACCOUNT",
      targetId: pending.userId,
      schoolId: pending.schoolId,
      officeId: current?.school.districtOfficeId ?? null,
      summary: `Turned down ${nameOf(pending.user)}'s transfer to ${pending.school.name}`,
      details: { fromSchoolId: current?.schoolId ?? null },
      actorUserId: actorId,
    });
    await this.notifySchoolLeaders(
      pending.schoolId,
      actorId,
      pending.userId,
      `Transfer turned down: ${nameOf(pending.user)}`,
      `${current?.school.name ?? "Their school"} turned down ${nameOf(pending.user)}'s transfer to ${pending.school.name}.`,
      pending.id
    );
    return { declined: true };
  }

  /** Withdraw (the school that asked). */
  async cancel(id: string, actor: SchoolLeaderContext) {
    this.requireLeader(actor);
    const pending = await transferRepository.findPending(id);
    if (!pending || pending.schoolId !== actor.schoolId) throw new NotFoundError("Transfer not found");
    await transferRepository.dropPending(pending);
    await auditService.record({
      action: "TRANSFER_CANCELLED",
      targetType: "ACCOUNT",
      targetId: pending.userId,
      schoolId: pending.schoolId,
      summary: `Withdrew the transfer request for ${nameOf(pending.user)}`,
      actorUserId: actor.userId,
    });
    return { cancelled: true };
  }

  /** Notifications to a school's head/deputy (and optionally the person), in that school. */
  private async notifySchoolLeaders(
    schoolId: string,
    senderId: string,
    personId: string,
    subject: string,
    message: string,
    membershipId: string,
    includePerson = false
  ) {
    try {
      const leaders = await transferRepository.findSchoolLeaders(schoolId, personId);
      const recipients = [...leaders.map((l) => l.userId), ...(includePerson ? [personId] : [])].filter((id) => id !== senderId);
      await runWithTenant({ schoolId, userId: senderId }, () =>
        transferRepository.notify(senderId, [...new Set(recipients)], subject, message, membershipId)
      );
    } catch (error) {
      logger.error("Couldn't send transfer notification", error instanceof Error ? error : undefined, { membershipId });
    }
  }
}

function nameOf(user: PendingTransfer["user"]): string {
  if (user.profile) return `${user.profile.firstName} ${user.profile.lastName}`;
  return user.displayName || user.email;
}

function roleLabel(role: string): string {
  switch (role) {
    case "HEAD_TEACHER":
      return "head teacher";
    case "DEPUTY_HEAD":
      return "deputy head";
    case "CLERK":
      return "clerk";
    default:
      return "teacher";
  }
}

export const transferService = new TransferService();
