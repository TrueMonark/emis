import { NotFoundError, ValidationError } from "@/lib/http/errors";
import { normalizeToUtcMidnight } from "@/lib/utils/date-utils";
import { FEE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@school/shared/fees/money";
import { feesRepository } from "./fees.repository";
import { financeAccess, type FinanceContext } from "./financeAccess";
import { learnerAccounts, type LearnerAccount } from "./ledger";
import { fullName, today } from "./fee.service";
import { paymentService } from "./payment.service";

const TERM_LABEL: Record<string, string> = { TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3" };
const EMPTY = (studentId: string): LearnerAccount => ({
  studentId,
  chargedNgwee: 0,
  discountNgwee: 0,
  paidNgwee: 0,
  balanceNgwee: 0,
  creditNgwee: 0,
  overdueNgwee: 0,
  charges: [],
});

/**
 * Learners' accounts and the money reports (school fees). Balances always come from the ledger
 * (`ledger.ts`), over every year, so arrears from last year show up.
 */
export class AccountService {
  /** The learners on this year's class lists with their balances (the "Learners" page). */
  async learners(ctx: FinanceContext, filter: { classId?: string | null; gradeId?: string | null; q?: string | null; owing?: boolean }) {
    await financeAccess(ctx);
    const year = await feesRepository.findActiveYear();
    if (!year) return [];
    const enrolled = await feesRepository.findEnrolled(year.id, {
      ...(filter.classId ? { classIds: [filter.classId] } : {}),
      ...(filter.gradeId ? { gradeIds: [filter.gradeId] } : {}),
    });
    const q = filter.q?.trim().toLowerCase();
    const matching = q
      ? enrolled.filter((e) =>
          [fullName(e.student), e.student.learnerNumber ?? "", e.student.studentNumber ?? ""].some((v) => v.toLowerCase().includes(q))
        )
      : enrolled;
    const { charges, payments } = await feesRepository.findLedger(matching.map((e) => e.studentId));
    const accounts = learnerAccounts(charges, payments, today());
    return matching
      .map((e) => {
        const a = accounts.get(e.studentId) ?? EMPTY(e.studentId);
        return {
          studentId: e.studentId,
          name: fullName(e.student),
          learnerNumber: e.student.learnerNumber,
          classId: e.classId,
          classLabel: `${e.class.grade.name} ${e.class.name}`,
          classOrder: e.class.grade.sequence,
          chargedNgwee: a.chargedNgwee,
          paidNgwee: a.paidNgwee,
          balanceNgwee: a.balanceNgwee,
          overdueNgwee: a.overdueNgwee,
          creditNgwee: a.creditNgwee,
        };
      })
      .filter((l) => !filter.owing || l.balanceNgwee > 0)
      .sort((a, b) => a.classOrder - b.classOrder || a.classLabel.localeCompare(b.classLabel) || a.name.localeCompare(b.name));
  }

  /** One learner's account: what they were charged, what they paid, discounts, who to call. */
  async account(ctx: FinanceContext, studentId: string) {
    const access = await financeAccess(ctx);
    const student = await feesRepository.findStudent(studentId);
    if (!student) throw new NotFoundError("Learner not found");
    const year = await feesRepository.findActiveYear();
    const [{ charges, payments }, enrolled, paymentList, discounts] = await Promise.all([
      feesRepository.findLedger([studentId]),
      year ? feesRepository.findEnrolled(year.id, { studentIds: [studentId] }) : Promise.resolve([]),
      paymentService.list(ctx, { studentId, includeVoided: true }),
      feesRepository.findDiscounts({ studentId }),
    ]);
    const account = learnerAccounts(charges, payments, today()).get(studentId) ?? EMPTY(studentId);
    const fees = new Map((await feesRepository.findFeesByIds([...new Set(charges.map((c) => c.feeId))])).map((f) => [f.id, f]));
    const chargeById = new Map(charges.map((c) => [c.id, c]));
    const guardian = student.studentGuardians[0]?.guardian;
    const e = enrolled[0];
    return {
      school: access.school,
      learner: {
        id: student.id,
        name: fullName(student),
        learnerNumber: student.learnerNumber,
        studentNumber: student.studentNumber,
        classLabel: e ? `${e.class.grade.name} ${e.class.name}` : null,
        guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : null,
        guardianPhone: guardian?.phone ?? null,
      },
      totals: {
        chargedNgwee: account.chargedNgwee,
        discountNgwee: account.discountNgwee,
        paidNgwee: account.paidNgwee,
        balanceNgwee: account.balanceNgwee,
        overdueNgwee: account.overdueNgwee,
        creditNgwee: account.creditNgwee,
      },
      charges: account.charges.map((b) => {
        const fee = fees.get(b.feeId);
        const c = chargeById.get(b.chargeId);
        return {
          ...b,
          feeName: fee?.name ?? "",
          category: fee?.category ?? "OTHER",
          categoryLabel: FEE_CATEGORY_LABELS[fee?.category ?? "OTHER"],
          period: fee ? `${fee.term ? `${TERM_LABEL[fee.term.termType]} ` : ""}${fee.academicYear.year}` : "",
          dueDate: fee?.dueDate ?? null,
          originalNgwee: c?.originalNgwee ?? b.amountNgwee,
          discountNgwee: c?.discountNgwee ?? 0,
        };
      }),
      payments: paymentList,
      discounts: discounts.map((d) => ({
        id: d.id,
        name: d.name,
        kind: d.kind,
        value: d.value,
        categories: d.categories,
        reason: d.reason,
        year: d.academicYear.year,
        endedAt: d.endedAt,
      })),
    };
  }

  /**
   * A class list with payments on the side: one row per learner, one column group per fee
   * (the fees of a term, or chosen fees), and the learner's whole balance.
   */
  async classList(ctx: FinanceContext, filter: { classId: string; termId?: string | null; feeIds?: string[] }) {
    const access = await financeAccess(ctx);
    const year = await feesRepository.findActiveYear();
    if (!year) throw new ValidationError("There's no active academic year");
    const classes = await feesRepository.findClasses();
    const cls = classes.find((c) => c.id === filter.classId);
    if (!cls) throw new NotFoundError("Class not found");
    const enrolled = await feesRepository.findEnrolled(year.id, { classIds: [cls.id] });
    const studentIds = enrolled.map((e) => e.studentId);
    const { charges, payments } = await feesRepository.findLedger(studentIds);
    const accounts = learnerAccounts(charges, payments, today());

    const candidateFees = await feesRepository.findFees({
      academicYearId: year.id,
      ...(filter.feeIds?.length ? { id: { in: filter.feeIds } } : filter.termId ? { OR: [{ termId: filter.termId }, { termId: null }] } : {}),
    });
    const charged = new Set(charges.map((c) => c.feeId));
    const columns = candidateFees.filter((f) => charged.has(f.id)).map((f) => ({ feeId: f.id, name: f.name, amountNgwee: f.amountNgwee, optional: f.optional }));

    const rows = enrolled
      .map((e) => {
        const a = accounts.get(e.studentId) ?? EMPTY(e.studentId);
        const byFee = new Map(a.charges.map((c) => [c.feeId, c]));
        return {
          studentId: e.studentId,
          name: fullName(e.student),
          learnerNumber: e.student.learnerNumber,
          fees: columns.map((col) => {
            const c = byFee.get(col.feeId);
            return c ? { charged: true, amountNgwee: c.amountNgwee, paidNgwee: c.paidNgwee, balanceNgwee: c.balanceNgwee, status: c.status } : { charged: false, amountNgwee: 0, paidNgwee: 0, balanceNgwee: 0, status: null };
          }),
          balanceNgwee: a.balanceNgwee,
          overdueNgwee: a.overdueNgwee,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const totals = {
      fees: columns.map((_, i) => ({
        amountNgwee: rows.reduce((s, r) => s + r.fees[i].amountNgwee, 0),
        paidNgwee: rows.reduce((s, r) => s + r.fees[i].paidNgwee, 0),
        balanceNgwee: rows.reduce((s, r) => s + r.fees[i].balanceNgwee, 0),
      })),
      balanceNgwee: rows.reduce((s, r) => s + r.balanceNgwee, 0),
    };
    return { school: access.school, classLabel: `${cls.grade.name} ${cls.name}`, year: year.year, generatedAt: new Date(), columns, rows, totals };
  }

  /** Who owes: learners with a balance (or only an overdue one), largest first, with a contact. */
  async debtors(ctx: FinanceContext, filter: { classId?: string | null; gradeId?: string | null; overdueOnly?: boolean; minNgwee?: number }) {
    const access = await financeAccess(ctx);
    const learners = await this.learners(ctx, { classId: filter.classId, gradeId: filter.gradeId });
    const owing = learners
      .filter((l) => (filter.overdueOnly ? l.overdueNgwee > 0 : l.balanceNgwee > 0))
      .filter((l) => !filter.minNgwee || l.balanceNgwee >= filter.minNgwee)
      .sort((a, b) => b.balanceNgwee - a.balanceNgwee);
    const contacts = await Promise.all(owing.map((l) => feesRepository.findStudent(l.studentId)));
    const rows = owing.map((l, i) => {
      const g = contacts[i]?.studentGuardians[0]?.guardian;
      return { ...l, guardianName: g ? `${g.firstName} ${g.lastName}` : null, guardianPhone: g?.phone ?? null };
    });
    return {
      school: access.school,
      generatedAt: new Date(),
      rows,
      totals: {
        learners: rows.length,
        balanceNgwee: rows.reduce((s, r) => s + r.balanceNgwee, 0),
        overdueNgwee: rows.reduce((s, r) => s + r.overdueNgwee, 0),
      },
    };
  }

  /** Money collected between two dates: by day, by method, by who received it. */
  async collections(ctx: FinanceContext, filter: { from: string; to: string }) {
    const access = await financeAccess(ctx);
    const from = normalizeToUtcMidnight(filter.from);
    const to = normalizeToUtcMidnight(filter.to);
    if (from > to) throw new ValidationError("The start date is after the end date");
    const all = await paymentService.list(ctx, { from: filter.from, to: filter.to, includeVoided: true });
    const recorded = all.filter((p) => p.status === "RECORDED");
    const group = <K extends string>(key: (p: (typeof recorded)[number]) => K) => {
      const m = new Map<K, { count: number; amountNgwee: number }>();
      for (const p of recorded) {
        const k = key(p);
        const g = m.get(k) ?? { count: 0, amountNgwee: 0 };
        g.count += 1;
        g.amountNgwee += p.amountNgwee;
        m.set(k, g);
      }
      return [...m.entries()].map(([k, v]) => ({ key: k, ...v }));
    };
    return {
      school: access.school,
      from,
      to,
      generatedAt: new Date(),
      payments: recorded.sort((a, b) => +new Date(a.paidOn) - +new Date(b.paidOn) || a.receiptNumber.localeCompare(b.receiptNumber)),
      voided: all.filter((p) => p.status === "VOIDED"),
      byDay: group((p) => new Date(p.paidOn).toISOString().slice(0, 10)).sort((a, b) => a.key.localeCompare(b.key)),
      byMethod: group((p) => p.method).map((g) => ({ ...g, label: PAYMENT_METHOD_LABELS[g.key] ?? g.key })),
      byReceiver: group((p) => p.receivedBy ?? "—"),
      totals: { count: recorded.length, amountNgwee: recorded.reduce((s, p) => s + p.amountNgwee, 0) },
    };
  }

  /** The finance dashboard. */
  async overview(ctx: FinanceContext) {
    const access = await financeAccess(ctx);
    const learners = await this.learners(ctx, {});
    const t = today();
    const monthStart = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
    const recent = await paymentService.list(ctx, { from: monthStart.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) });
    const byClass = new Map<string, { classLabel: string; classOrder: number; balanceNgwee: number; learners: number }>();
    for (const l of learners) {
      const c = byClass.get(l.classId) ?? { classLabel: l.classLabel, classOrder: l.classOrder, balanceNgwee: 0, learners: 0 };
      if (l.balanceNgwee > 0) {
        c.balanceNgwee += l.balanceNgwee;
        c.learners += 1;
      }
      byClass.set(l.classId, c);
    }
    const todayKey = t.toISOString().slice(0, 10);
    return {
      canEdit: access.canEdit,
      isLeader: access.isLeader,
      school: access.school,
      learners: learners.length,
      chargedNgwee: learners.reduce((s, l) => s + l.chargedNgwee, 0),
      paidNgwee: learners.reduce((s, l) => s + l.paidNgwee, 0),
      outstandingNgwee: learners.reduce((s, l) => s + Math.max(0, l.balanceNgwee), 0),
      overdueNgwee: learners.reduce((s, l) => s + l.overdueNgwee, 0),
      owingLearners: learners.filter((l) => l.balanceNgwee > 0).length,
      paidUpLearners: learners.filter((l) => l.chargedNgwee > 0 && l.balanceNgwee <= 0).length,
      todayNgwee: recent.filter((p) => new Date(p.paidOn).toISOString().slice(0, 10) === todayKey).reduce((s, p) => s + p.amountNgwee, 0),
      monthNgwee: recent.reduce((s, p) => s + p.amountNgwee, 0),
      recentPayments: recent.slice(0, 8),
      classes: [...byClass.entries()]
        .map(([classId, c]) => ({ classId, ...c }))
        .sort((a, b) => a.classOrder - b.classOrder || a.classLabel.localeCompare(b.classLabel)),
    };
  }
}

export const accountService = new AccountService();
