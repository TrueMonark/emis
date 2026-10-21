import { parseSignInId, formatZambianPhone } from "@school/shared/auth/sign-in-id";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { runWithTenant, currentTenant } from "@/lib/db/tenant";
import { logger } from "@/lib/logger/logger";
import { sendStaffSms } from "@/lib/sms/send-staff-sms";
import { issueOneTimePassword, oneTimePasswordTtlHours } from "@/features/auth/one-time-password";
import { auditService } from "@/features/audit/audit.service";
import type { OfficeContext } from "@/features/offices/office.service";
import { passwordResetRepository, type ResetRequestRow } from "./passwordReset.repository";

/** An open request no one has handled stops counting after this many days (ask again). */
export const RESET_REQUEST_LIFETIME_DAYS = 7;

/** What the sign-in page always says, whether or not the account exists. */
export const RESET_REQUEST_REPLY =
  "If this account exists, your school (or your office) has been asked to reset your password. They will give you a one-time password.";

/** Who may handle a request: school leaders, or the heads of one education office. */
interface Route {
  handlerSchoolId: string | null;
  handlerOfficeId: string | null;
}

export interface SchoolHandler {
  kind: "school";
  userId: string;
  role: string;
  schoolId: string;
}
export interface OfficeHandler {
  kind: "office";
  ctx: OfficeContext;
}
export type ResetHandler = SchoolHandler | OfficeHandler;

/**
 * "Forgot password?" (design §3b). Nobody resets their own password: the request goes to
 *
 *   | Person who forgot       | Handled by                                  |
 *   |-------------------------|---------------------------------------------|
 *   | staff at a school        | the school's head teacher and deputy head   |
 *   | head teacher / deputy    | the other one (head ↔ deputy)               |
 *   | nobody else leads school | the DEBS of the school's district           |
 *   | DEBS staff               | their PEO                                   |
 *   | PEO staff                | HQ                                          |
 *
 * and if the office it would go to has no head, to the office above it (up to HQ). The person
 * handling it confirms who is asking (in person or by phone) and presses "Reset password", which
 * issues a one-time password shown once to them. There is no other way to reset someone's
 * password, except re-issuing one for an account that has never been used.
 */
export class PasswordResetService {
  /**
   * The sign-in page's "Forgot password?". Never says whether the account exists: unknown,
   * deactivated and unlinked accounts get the same reply and nothing happens.
   */
  async request(typedId: string): Promise<void> {
    const id = parseSignInId(typedId);
    if (!id) return;
    const user =
      id.kind === "email"
        ? await passwordResetRepository.findUserByEmail(id.value)
        : await passwordResetRepository.findUserByPhone(id.value);
    if (!user || !user.isActive) return;

    const route = await this.routeFor(user.id);
    if (!route) return;

    const open = await passwordResetRepository.findOpenForUser(user.id);
    let request: ResetRequestRow;
    try {
      request = open
        ? await passwordResetRepository.renew(open.id, route)
        : await passwordResetRepository.create({ userId: user.id, ...route });
    } catch (error) {
      // Two requests at the same moment: one open request per person is enough.
      if ((error as { code?: string })?.code === "P2002") return;
      throw error;
    }

    if (route.handlerSchoolId) await this.notifySchool(route.handlerSchoolId, request);
  }

  /** Where a request from this person goes (null: they work nowhere, so nobody can help). */
  async routeFor(userId: string): Promise<Route | null> {
    const school = await passwordResetRepository.findActiveSchoolMembership(userId);
    if (school) {
      const leaders = await passwordResetRepository.findSchoolLeaders(school.schoolId, userId);
      if (leaders.length > 0) return { handlerSchoolId: school.schoolId, handlerOfficeId: null };
      return { handlerSchoolId: null, handlerOfficeId: await this.officeWithHead(school.school.districtOfficeId, userId) };
    }
    const office = await passwordResetRepository.findActiveOfficeMembership(userId);
    if (office) {
      // Office staff are reset by the office above (HQ by the other HQ heads).
      const start = office.office.parentId ?? office.officeId;
      return { handlerSchoolId: null, handlerOfficeId: await this.officeWithHead(start, userId) };
    }
    return null;
  }

  /** This office, or the first one above it, that has a head who isn't the person asking. */
  private async officeWithHead(officeId: string, requesterId: string): Promise<string> {
    let current = await passwordResetRepository.findOffice(officeId);
    let last = officeId;
    while (current) {
      last = current.id;
      if ((await passwordResetRepository.countOfficeHeads(current.id, requesterId)) > 0) return current.id;
      if (!current.parentId) break;
      current = await passwordResetRepository.findOffice(current.parentId);
    }
    // Nobody above has a head (or the person is HQ's only head): it waits at the top. HQ's last
    // resort is `npm run office:create-account -- --email … --reset`.
    return last;
  }

  private async notifySchool(schoolId: string, request: ResetRequestRow) {
    try {
      const leaders = await passwordResetRepository.findSchoolLeaders(schoolId, request.userId);
      if (leaders.length === 0) return;
      const name = personName(request.user);
      await runWithTenant({ schoolId, userId: request.userId }, () =>
        passwordResetRepository.notifySchoolLeaders(
          request.userId,
          leaders.map((l) => l.userId),
          `Password reset request: ${name}`,
          `${name} has asked for a new password. Confirm it's really them (in person or by phone), then open Teachers → "Password reset requests" and press "Reset password". You'll get a one-time password to give them.`,
          request.id
        )
      );
    } catch (error) {
      // The request exists and shows on the Teachers page; a missing notification isn't fatal.
      logger.error("Couldn't notify school leaders of a reset request", error instanceof Error ? error : undefined, {
        requestId: request.id,
      });
    }
  }

  // ---------------------------------------------------------------------------------------
  // Handling requests
  // ---------------------------------------------------------------------------------------

  /** Open requests this head/deputy (or office) handles. */
  async listOpen(handler: ResetHandler) {
    const since = new Date(Date.now() - RESET_REQUEST_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
    let rows: ResetRequestRow[];
    let selfId: string;
    if (handler.kind === "school") {
      if (!isSchoolLeader(handler.role)) {
        throw new ForbiddenError("Only the head teacher or deputy head handles password reset requests");
      }
      selfId = handler.userId;
      rows = await passwordResetRepository.findOpen({ handlerSchoolId: handler.schoolId }, since, selfId);
    } else {
      selfId = handler.ctx.userId;
      rows = await passwordResetRepository.findOpen({ handlerOfficeId: handler.ctx.office.officeId }, since, selfId);
    }
    const [schoolRoles, officeRoles] = await passwordResetRepository.findRolesOf(rows.map((r) => r.userId));
    return rows.map((r) => {
      const atSchool = schoolRoles.find((m) => m.userId === r.userId);
      const atOffice = officeRoles.find((m) => m.userId === r.userId);
      return {
        id: r.id,
        userId: r.userId,
        requestedAt: r.requestedAt,
        name: personName(r.user),
        email: r.user.email,
        phone: formatZambianPhone(r.user.phone ?? r.user.profile?.phone ?? null) || null,
        worksAt: atSchool
          ? { kind: "school" as const, name: atSchool.school.name, role: atSchool.role }
          : atOffice
            ? { kind: "office" as const, name: atOffice.office.name, role: atOffice.title ?? atOffice.role }
            : null,
      };
    });
  }

  /** The open request this person may handle, or an error saying why not. */
  private async handleable(requestId: string, handler: ResetHandler) {
    const request = await passwordResetRepository.findById(requestId);
    const since = Date.now() - RESET_REQUEST_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
    if (!request) throw new NotFoundError("Reset request not found");

    const mine =
      handler.kind === "school"
        ? request.handlerSchoolId === handler.schoolId
        : request.handlerOfficeId === handler.ctx.office.officeId;
    if (!mine) throw new NotFoundError("Reset request not found");

    if (handler.kind === "school" && !isSchoolLeader(handler.role)) {
      throw new ForbiddenError("Only the head teacher or deputy head can reset passwords");
    }
    if (handler.kind === "office" && handler.ctx.office.role !== "OFFICE_HEAD") {
      throw new ForbiddenError("Only the head of the office can reset passwords");
    }
    const selfId = handler.kind === "school" ? handler.userId : handler.ctx.userId;
    if (request.userId === selfId) throw new ForbiddenError("Nobody can reset their own password");
    if (request.status !== "OPEN") throw new ValidationError("This request has already been handled");
    if (request.requestedAt.getTime() < since) {
      throw new ValidationError("This request is too old. Ask them to press \"Forgot password?\" again.");
    }
    if (!request.user.isActive) throw new ValidationError("This account has been deactivated");
    return request;
  }

  /**
   * "Reset password" on an open request: a new one-time password, shown once to the person
   * resetting (and sent by SMS when the school has SMS set up). The request closes.
   */
  async reset(requestId: string, handler: ResetHandler) {
    const request = await this.handleable(requestId, handler);
    const handledById = handler.kind === "school" ? handler.userId : handler.ctx.userId;

    const otp = await issueOneTimePassword();
    await passwordResetRepository.resolve(request.id, request.userId, handledById, otp);

    const name = personName(request.user);
    await auditService.record({
      action: "PASSWORD_RESET",
      targetType: "ACCOUNT",
      targetId: request.userId,
      schoolId: request.handlerSchoolId,
      officeId: request.handlerOfficeId,
      summary: `Reset the password of ${name} (asked ${request.requestedAt.toLocaleString("en-GB", { timeZone: "Africa/Lusaka" })})`,
      details: { requestId: request.id, requestedAt: request.requestedAt.toISOString() },
      actorUserId: handledById,
    });
    logger.info("Password reset from a request", { requestId: request.id, resetBy: handledById });

    // SMS uses the school's SMS settings, so only when a school handles it.
    const phone = request.user.profile?.phone ?? request.user.phone;
    if (handler.kind === "school" && phone) {
      sendStaffSms(
        phone,
        `Your school system password has been reset.\nOne-time password: ${otp.password}\nIt expires in ${oneTimePasswordTtlHours()} hours. You will be asked to choose your own password when you sign in.`
      ).catch((err) => logger.error("Password reset SMS failed", err instanceof Error ? err : undefined));
    }

    return {
      name,
      email: request.user.email,
      temporaryPassword: otp.password,
      temporaryPasswordExpiresAt: otp.expiresAt,
    };
  }

  /** "Turn down": e.g. they couldn't confirm who asked. The person can ask again. */
  async decline(requestId: string, handler: ResetHandler) {
    const request = await this.handleable(requestId, handler);
    const handledById = handler.kind === "school" ? handler.userId : handler.ctx.userId;
    await passwordResetRepository.decline(request.id, handledById);
    await auditService.record({
      action: "PASSWORD_RESET_DECLINED",
      targetType: "ACCOUNT",
      targetId: request.userId,
      schoolId: request.handlerSchoolId,
      officeId: request.handlerOfficeId,
      summary: `Turned down a password reset request from ${personName(request.user)}`,
      details: { requestId: request.id },
      actorUserId: handledById,
    });
    return { declined: true };
  }

  /** The open request (routed to the current school) from this person, if any. */
  async openRequestAtCurrentSchool(userId: string) {
    const { schoolId } = currentTenant();
    const open = await passwordResetRepository.findOpenForUser(userId);
    const since = Date.now() - RESET_REQUEST_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
    if (!open || !schoolId || open.handlerSchoolId !== schoolId || open.requestedAt.getTime() < since) return null;
    return open;
  }
}

function personName(user: ResetRequestRow["user"]): string {
  if (user.profile) return `${user.profile.firstName} ${user.profile.lastName}`;
  return user.displayName || user.email;
}

export const passwordResetService = new PasswordResetService();
