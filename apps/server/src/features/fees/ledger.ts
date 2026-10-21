/**
 * A learner's fees account (pure functions, no database).
 *
 * Payments aren't tied to charges in the database; the split is worked out here every time, so
 * it can never drift from the payments themselves:
 *  1. a payment made towards a particular fee (e.g. the trip) pays that fee first;
 *  2. everything else pays the oldest balances first (by due date): arrears before this term;
 *  3. whatever is left over is the learner's credit.
 * Voided payments don't count.
 *
 * "Due now" follows the payment plan: with instalments (e.g. 50% by 15/01, 50% by 15/02) the
 * share due by today; without, the whole fee once its due date has passed.
 */

export interface LedgerCharge {
  id: string;
  feeId: string;
  studentId: string;
  amountNgwee: number;
  originalNgwee: number;
  discountNgwee: number;
  dueDate: Date;
  createdAt: Date;
  instalments: { dueDate: Date; percent: number }[];
}

export interface LedgerPayment {
  id: string;
  studentId: string;
  amountNgwee: number;
  feeId: string | null;
}

export type ChargeStatus = "PAID" | "PART_PAID" | "UNPAID" | "WAIVED";

export interface ChargeBalance {
  chargeId: string;
  feeId: string;
  amountNgwee: number;
  paidNgwee: number;
  balanceNgwee: number;
  dueNowNgwee: number;
  overdueNgwee: number;
  status: ChargeStatus;
}

export interface LearnerAccount {
  studentId: string;
  chargedNgwee: number;
  discountNgwee: number;
  paidNgwee: number;
  /** Charged − paid (negative = the learner is in credit) */
  balanceNgwee: number;
  creditNgwee: number;
  overdueNgwee: number;
  charges: ChargeBalance[];
}

/** The amount of a charge that is due by `today`. */
export function dueBy(charge: LedgerCharge, today: Date): number {
  if (charge.instalments.length === 0) return charge.dueDate <= today ? charge.amountNgwee : 0;
  const percent = charge.instalments.filter((i) => i.dueDate <= today).reduce((s, i) => s + i.percent, 0);
  return Math.round((charge.amountNgwee * Math.min(percent, 100)) / 100);
}

export function learnerAccount(studentId: string, charges: LedgerCharge[], payments: LedgerPayment[], today: Date): LearnerAccount {
  const ordered = [...charges].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
  );
  const paid = new Map<string, number>(ordered.map((c) => [c.id, 0]));
  const room = (c: LedgerCharge) => c.amountNgwee - (paid.get(c.id) ?? 0);

  let pool = 0;
  for (const p of payments) {
    const target = p.feeId ? ordered.find((c) => c.feeId === p.feeId) : undefined;
    if (target) {
      const used = Math.min(room(target), p.amountNgwee);
      paid.set(target.id, (paid.get(target.id) ?? 0) + used);
      pool += p.amountNgwee - used;
    } else {
      pool += p.amountNgwee;
    }
  }
  for (const c of ordered) {
    if (pool <= 0) break;
    const used = Math.min(room(c), pool);
    if (used > 0) {
      paid.set(c.id, (paid.get(c.id) ?? 0) + used);
      pool -= used;
    }
  }

  const balances: ChargeBalance[] = ordered.map((c) => {
    const p = paid.get(c.id) ?? 0;
    const balance = c.amountNgwee - p;
    const dueNow = dueBy(c, today);
    return {
      chargeId: c.id,
      feeId: c.feeId,
      amountNgwee: c.amountNgwee,
      paidNgwee: p,
      balanceNgwee: balance,
      dueNowNgwee: dueNow,
      overdueNgwee: Math.max(0, dueNow - p),
      status: c.amountNgwee === 0 ? "WAIVED" : balance === 0 ? "PAID" : p > 0 ? "PART_PAID" : "UNPAID",
    };
  });

  const charged = ordered.reduce((s, c) => s + c.amountNgwee, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amountNgwee, 0);
  return {
    studentId,
    chargedNgwee: charged,
    discountNgwee: ordered.reduce((s, c) => s + c.discountNgwee, 0),
    paidNgwee: totalPaid,
    balanceNgwee: charged - totalPaid,
    creditNgwee: pool,
    overdueNgwee: balances.reduce((s, b) => s + b.overdueNgwee, 0),
    charges: balances,
  };
}

/** Accounts for many learners at once (charges and payments grouped by learner). */
export function learnerAccounts(charges: LedgerCharge[], payments: LedgerPayment[], today: Date): Map<string, LearnerAccount> {
  const byStudent = new Map<string, { c: LedgerCharge[]; p: LedgerPayment[] }>();
  const slot = (id: string) => byStudent.get(id) ?? byStudent.set(id, { c: [], p: [] }).get(id)!;
  for (const c of charges) slot(c.studentId).c.push(c);
  for (const p of payments) slot(p.studentId).p.push(p);
  const out = new Map<string, LearnerAccount>();
  for (const [id, { c, p }] of byStudent) out.set(id, learnerAccount(id, c, p, today));
  return out;
}

/**
 * The discount on one charge: every active discount of the learner whose categories include the
 * fee's (or that has none = all fees). Percentages apply to the full amount; fixed amounts come
 * off each matching fee. Never more than the fee itself.
 */
export function discountFor(
  originalNgwee: number,
  category: string,
  discounts: { kind: "PERCENT" | "AMOUNT"; value: number; categories: string[] }[]
): number {
  let total = 0;
  for (const d of discounts) {
    if (d.categories.length > 0 && !d.categories.includes(category)) continue;
    total += d.kind === "PERCENT" ? Math.round((originalNgwee * d.value) / 100) : d.value;
  }
  return Math.min(total, originalNgwee);
}
