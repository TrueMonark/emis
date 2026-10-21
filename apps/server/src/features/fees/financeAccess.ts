import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { ForbiddenError } from "@/lib/http/errors";
import { feesRepository } from "./fees.repository";

export interface FinanceContext {
  userId: string;
  role: string;
}

export interface FinanceAccess {
  /** Finance staff: set up fees, record and void payments, discounts */
  canEdit: boolean;
  /** Head teacher / deputy: view and print everything, manage finance staff accounts */
  isLeader: boolean;
  school: { id: string; name: string };
}

/**
 * Who may use the school fees pages (decided 19 October 2026):
 *  - only in schools with the fees module on (always on for private schools; the DEBS can switch
 *    it on for others);
 *  - finance staff (role FINANCE) do everything;
 *  - the head teacher and deputy see and print everything, but don't record payments or change
 *    fees;
 *  - teachers and clerks see nothing.
 */
export async function financeAccess(ctx: FinanceContext): Promise<FinanceAccess> {
  const school = await feesRepository.findSchool();
  if (!school?.feesEnabled) {
    throw new ForbiddenError("School fees aren't switched on for this school. The district office (DEBS) can switch them on.");
  }
  const isLeader = isSchoolLeader(ctx.role);
  if (ctx.role !== "FINANCE" && !isLeader) {
    throw new ForbiddenError("School fees are for the finance office and the head teacher or deputy");
  }
  return { canEdit: ctx.role === "FINANCE", isLeader, school: { id: school.id, name: school.name } };
}

/** For anything that changes money records: finance staff only. */
export async function requireFinanceEditor(ctx: FinanceContext): Promise<FinanceAccess> {
  const access = await financeAccess(ctx);
  if (!access.canEdit) {
    throw new ForbiddenError("Only finance staff change fees and record payments. The head teacher and deputy can view and print.");
  }
  return access;
}
