import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { issueOneTimePassword } from "@/features/auth/one-time-password";
import { signInPhoneFor } from "@/features/auth/sign-in-phone";
import { auditService } from "@/features/audit/audit.service";
import { feesRepository } from "./fees.repository";
import { financeAccess, type FinanceContext } from "./financeAccess";
import type { CreateFinanceStaffInput } from "./fees.validation";

/**
 * Finance staff accounts (role FINANCE): made and ended by the head teacher or deputy. They are
 * not teachers — no teacher profile, no classes — and can only open the school fees pages
 * (`FINANCE_ALLOWED_PREFIXES`, enforced in withAuth).
 */
export class FinanceStaffService {
  private async requireLeader(ctx: FinanceContext) {
    const access = await financeAccess(ctx);
    if (!isSchoolLeader(ctx.role)) throw new ForbiddenError("Only the head teacher or deputy manage finance staff accounts");
    return access;
  }

  async list(ctx: FinanceContext) {
    await financeAccess(ctx);
    const rows = await feesRepository.findFinanceStaff();
    return rows.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: m.user.displayName,
      email: m.user.email,
      phone: m.user.phone,
      status: m.status,
      startDate: m.startDate,
      endDate: m.endDate,
      lastLogin: m.user.lastLogin,
      waitingForFirstSignIn: m.user.hasDefaultPassword,
    }));
  }

  async create(ctx: FinanceContext, input: CreateFinanceStaffInput) {
    const access = await this.requireLeader(ctx);
    if (await feesRepository.findUserByEmail(input.email)) {
      throw new ConflictError("That email already has an account. Finance staff need their own email.");
    }
    const otp = await issueOneTimePassword();
    const phone = await signInPhoneFor(input.phone);
    try {
      const user = await feesRepository.createFinanceAccount({
        email: input.email,
        phone,
        displayName: input.displayName,
        passwordHash: otp.passwordHash,
        expiresAt: otp.expiresAt,
      });
      await auditService.record({
        action: "ACCOUNT_CREATED",
        targetType: "ACCOUNT",
        targetId: user.id,
        schoolId: access.school.id,
        summary: `Finance staff account for ${input.displayName} (${input.email})`,
      });
      return {
        userId: user.id,
        email: user.email,
        name: user.displayName,
        signInPhone: phone,
        temporaryPassword: otp.password,
        temporaryPasswordExpiresAt: otp.expiresAt.toISOString(),
      };
    } catch (error) {
      if (error && typeof error === "object" && (error as { code?: string }).code === "P2002") {
        throw new ConflictError("That email already has an account. Finance staff need their own email.");
      }
      throw error;
    }
  }

  async end(ctx: FinanceContext, membershipId: string) {
    const access = await this.requireLeader(ctx);
    const m = await feesRepository.findMembership(membershipId);
    if (!m || m.role !== "FINANCE") throw new NotFoundError("Finance staff account not found");
    if (m.status !== "ACTIVE") throw new ValidationError("This account has already ended");
    await feesRepository.endMembership(m.id);
    await auditService.record({
      action: "MEMBERSHIP_ENDED",
      targetType: "ACCOUNT",
      targetId: m.userId,
      schoolId: access.school.id,
      summary: `Finance staff account of ${m.user.displayName || m.user.email} ended`,
    });
    return { ended: true };
  }
}

export const financeStaffService = new FinanceStaffService();
