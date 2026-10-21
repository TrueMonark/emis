import { ConflictError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { normalizeToUtcMidnight } from "@/lib/utils/date-utils";
import { FEE_CATEGORY_LABELS, formatKwacha } from "@school/shared/fees/money";
import { auditService } from "@/features/audit/audit.service";
import { feesRepository, type FeeRow } from "./fees.repository";
import { financeAccess, requireFinanceEditor, type FinanceContext } from "./financeAccess";
import { discountFor, learnerAccounts } from "./ledger";
import type { CreateDiscountInput, CreateFeeInput, TermFeesInput, UpdateFeeInput } from "./fees.validation";

const TERM_LABEL: Record<string, string> = { TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3" };

/**
 * Fees and who owes them (school fees, requested 19 October 2026).
 *
 * A fee is charged to learners as one FeeCharge each: everyone on a class list this year, the
 * chosen year levels or classes, or learners added one by one (trips and other optional fees).
 * New learners are added with "Update charges". A charge's amount is the fee less the learner's
 * discounts, recalculated whenever a discount starts or ends.
 */
export class FeeService {
  async options(ctx: FinanceContext) {
    const access = await financeAccess(ctx);
    const [years, terms, grades, classes, activeYear] = await Promise.all([
      feesRepository.findYears(),
      feesRepository.findTerms(),
      feesRepository.findGrades(),
      feesRepository.findClasses(),
      feesRepository.findActiveYear(),
    ]);
    return {
      canEdit: access.canEdit,
      isLeader: access.isLeader,
      school: access.school,
      activeYear,
      years,
      terms: terms.map((t) => ({ ...t, label: `${TERM_LABEL[t.termType] ?? t.termType} ${years.find((y) => y.id === t.academicYearId)?.year ?? ""}`.trim() })),
      grades,
      classes: classes.map((c) => ({ id: c.id, gradeId: c.gradeId, label: `${c.grade.name} ${c.name}` })),
      categories: Object.entries(FEE_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    };
  }

  async listFees(ctx: FinanceContext, filter: { termId?: string | null; academicYearId?: string | null; includeArchived?: boolean }) {
    await financeAccess(ctx);
    const year = filter.academicYearId ?? (await feesRepository.findActiveYear())?.id;
    const fees = await feesRepository.findFees({
      ...(year ? { academicYearId: year } : {}),
      ...(filter.termId ? { termId: filter.termId } : {}),
      ...(filter.includeArchived ? {} : { archived: false }),
    });
    const { charges, payments } = await feesRepository.findLedger();
    const accounts = learnerAccounts(charges, payments, today());
    const totals = new Map<string, { charged: number; paid: number }>();
    for (const account of accounts.values()) {
      for (const c of account.charges) {
        const t = totals.get(c.feeId) ?? { charged: 0, paid: 0 };
        t.charged += c.amountNgwee;
        t.paid += c.paidNgwee;
        totals.set(c.feeId, t);
      }
    }
    return fees.map((f) => presentFee(f, totals.get(f.id) ?? { charged: 0, paid: 0 }));
  }

  async getFee(ctx: FinanceContext, id: string) {
    await financeAccess(ctx);
    const fee = await feesRepository.findFee(id);
    if (!fee) throw new NotFoundError("Fee not found");
    const charges = await feesRepository.findChargesOfFee(id);
    const studentIds = charges.map((c) => c.studentId);
    const [{ charges: ledgerCharges, payments }, enrolled] = await Promise.all([
      feesRepository.findLedger(studentIds),
      feesRepository.findEnrolled(fee.academicYearId, { studentIds }),
    ]);
    const accounts = learnerAccounts(ledgerCharges, payments, today());
    const enrolment = new Map(enrolled.map((e) => [e.studentId, e]));
    const learners = charges
      .map((c) => {
        const line = accounts.get(c.studentId)?.charges.find((x) => x.chargeId === c.id);
        const e = enrolment.get(c.studentId);
        return {
          studentId: c.studentId,
          name: e ? fullName(e.student) : "(no longer on a class list)",
          learnerNumber: e?.student.learnerNumber ?? null,
          classLabel: e ? `${e.class.grade.name} ${e.class.name}` : null,
          classOrder: e?.class.grade.sequence ?? 999,
          originalNgwee: c.originalNgwee,
          discountNgwee: c.discountNgwee,
          amountNgwee: line?.amountNgwee ?? c.originalNgwee - c.discountNgwee,
          paidNgwee: line?.paidNgwee ?? 0,
          balanceNgwee: line?.balanceNgwee ?? 0,
          overdueNgwee: line?.overdueNgwee ?? 0,
          status: line?.status ?? "UNPAID",
        };
      })
      .sort((a, b) => a.classOrder - b.classOrder || (a.classLabel ?? "").localeCompare(b.classLabel ?? "") || a.name.localeCompare(b.name));
    const totals = learners.reduce((t, l) => ({ charged: t.charged + l.amountNgwee, paid: t.paid + l.paidNgwee }), { charged: 0, paid: 0 });
    return { fee: presentFee(fee, totals), learners };
  }

  /** Learners a fee can be charged to (for "Add learners" on optional fees). */
  async eligibleLearners(ctx: FinanceContext, id: string) {
    await financeAccess(ctx);
    const fee = await feesRepository.findFee(id);
    if (!fee) throw new NotFoundError("Fee not found");
    const enrolled = await this.eligible(fee);
    const charged = new Set((await feesRepository.findChargesOfFee(id)).map((c) => c.studentId));
    return enrolled
      .map((e) => ({
        studentId: e.studentId,
        name: fullName(e.student),
        classId: e.classId,
        classLabel: `${e.class.grade.name} ${e.class.name}`,
        classOrder: e.class.grade.sequence,
        charged: charged.has(e.studentId),
      }))
      .sort((a, b) => a.classOrder - b.classOrder || a.classLabel.localeCompare(b.classLabel) || a.name.localeCompare(b.name));
  }

  private eligible(fee: FeeRow) {
    if (fee.targetKind === "YEAR_LEVELS") {
      return feesRepository.findEnrolled(fee.academicYearId, { gradeIds: fee.targets.map((t) => t.gradeId).filter((x): x is string => !!x) });
    }
    if (fee.targetKind === "CLASSES") {
      return feesRepository.findEnrolled(fee.academicYearId, { classIds: fee.targets.map((t) => t.classId).filter((x): x is string => !!x) });
    }
    return feesRepository.findEnrolled(fee.academicYearId);
  }

  async createFee(ctx: FinanceContext, input: CreateFeeInput) {
    await requireFinanceEditor(ctx);
    const { academicYearId } = await this.yearFor(input.termId ?? null);
    const fee = await feesRepository.createFee({
      name: input.name,
      category: input.category,
      description: input.description || null,
      academicYearId,
      termId: input.termId || null,
      amountNgwee: input.amountNgwee,
      dueDate: normalizeToUtcMidnight(input.dueDate),
      targetKind: input.targetKind,
      optional: input.targetKind === "LEARNERS" ? true : input.optional,
      createdById: ctx.userId,
      targets:
        input.targetKind === "YEAR_LEVELS"
          ? input.gradeIds.map((gradeId) => ({ gradeId }))
          : input.targetKind === "CLASSES"
            ? input.classIds.map((classId) => ({ classId }))
            : [],
      instalments: input.instalments.map((i) => ({ label: i.label, dueDate: normalizeToUtcMidnight(i.dueDate), percent: i.percent })),
    });
    let charged = 0;
    if (!fee.optional) charged = await this.chargeMissing(fee);
    if (input.studentIds.length > 0) charged += await this.charge(fee, input.studentIds, true);
    await auditService.record({
      action: "FEE_CREATED",
      targetType: "SCHOOL",
      targetId: fee.id,
      schoolId: fee.schoolId,
      summary: `Fee "${fee.name}" (${formatKwacha(fee.amountNgwee)}) set up, charged to ${charged} learner(s)`,
    });
    return { ...presentFee(fee, { charged: 0, paid: 0 }), charged };
  }

  /** "Term fees": one fee per year level for a term, each with its own amount. */
  async createTermFees(ctx: FinanceContext, input: TermFeesInput) {
    await requireFinanceEditor(ctx);
    const term = await feesRepository.findTerm(input.termId);
    if (!term) throw new NotFoundError("Term not found");
    const grades = new Map((await feesRepository.findGrades()).map((g) => [g.id, g]));
    const created = [];
    for (const a of input.amounts.filter((x) => x.amountNgwee > 0)) {
      const grade = grades.get(a.gradeId);
      if (!grade) throw new NotFoundError("Year level not found");
      created.push(
        await this.createFee(ctx, {
          name: `${input.name} – ${grade.name}`,
          category: input.category,
          description: null,
          termId: term.id,
          amountNgwee: a.amountNgwee,
          dueDate: input.dueDate,
          targetKind: "YEAR_LEVELS",
          gradeIds: [grade.id],
          classIds: [],
          studentIds: [],
          optional: false,
          instalments: input.instalments,
        })
      );
    }
    if (created.length === 0) throw new ValidationError("Give at least one year level an amount");
    return { created: created.length, charged: created.reduce((s, f) => s + f.charged, 0) };
  }

  async updateFee(ctx: FinanceContext, id: string, input: UpdateFeeInput) {
    await requireFinanceEditor(ctx);
    const fee = await feesRepository.findFee(id);
    if (!fee) throw new NotFoundError("Fee not found");
    const updated = await feesRepository.updateFee(
      id,
      {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.dueDate ? { dueDate: normalizeToUtcMidnight(input.dueDate) } : {}),
        ...(input.amountNgwee ? { amountNgwee: input.amountNgwee } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
      },
      input.instalments?.map((i) => ({ label: i.label, dueDate: normalizeToUtcMidnight(i.dueDate), percent: i.percent }))
    );
    if (input.amountNgwee && input.amountNgwee !== fee.amountNgwee) {
      // Everyone's charge follows the new amount (less their own discounts).
      const charges = await feesRepository.findChargesOfFee(id);
      const discounts = await feesRepository.findActiveDiscounts(charges.map((c) => c.studentId), fee.academicYearId);
      await feesRepository.updateCharges(
        charges.map((c) => {
          const d = discountFor(input.amountNgwee!, fee.category, discounts.filter((x) => x.studentId === c.studentId));
          return { id: c.id, originalNgwee: input.amountNgwee!, discountNgwee: d, amountNgwee: input.amountNgwee! - d };
        })
      );
      await auditService.record({
        action: "FEE_UPDATED",
        targetType: "SCHOOL",
        targetId: id,
        schoolId: fee.schoolId,
        summary: `Fee "${fee.name}" changed from ${formatKwacha(fee.amountNgwee)} to ${formatKwacha(input.amountNgwee)}`,
      });
    }
    return presentFee(updated, { charged: 0, paid: 0 });
  }

  /** Delete a fee nobody has been charged or paid; otherwise archive it instead. */
  async deleteFee(ctx: FinanceContext, id: string) {
    await requireFinanceEditor(ctx);
    const fee = await feesRepository.findFee(id);
    if (!fee) throw new NotFoundError("Fee not found");
    if (fee._count.charges > 0 || (await feesRepository.countPaymentsForFee(id)) > 0) {
      throw new ConflictError("Learners have been charged this fee. Archive it instead (their charges and payments stay).");
    }
    await feesRepository.deleteFee(id);
    return { deleted: true };
  }

  /** Charge learners (sign-ups for an optional fee, or individual additions). */
  async addLearners(ctx: FinanceContext, id: string, studentIds: string[]) {
    await requireFinanceEditor(ctx);
    const fee = await feesRepository.findFee(id);
    if (!fee) throw new NotFoundError("Fee not found");
    if (fee.archived) throw new ValidationError("This fee is archived");
    return { charged: await this.charge(fee, studentIds, true) };
  }

  async removeLearner(ctx: FinanceContext, id: string, studentId: string) {
    await requireFinanceEditor(ctx);
    const fee = await feesRepository.findFee(id);
    if (!fee) throw new NotFoundError("Fee not found");
    if ((await feesRepository.countEarmarkedPayments(id, studentId)) > 0) {
      throw new ConflictError("This learner has paid towards this fee. Cancel (void) that payment first, or keep the charge.");
    }
    await feesRepository.deleteCharge(id, studentId);
    await auditService.record({
      action: "FEE_UPDATED",
      targetType: "SCHOOL",
      targetId: id,
      schoolId: fee.schoolId,
      summary: `Removed a learner's charge for "${fee.name}"`,
    });
    return { removed: true };
  }

  /** "Update charges": charge learners who joined since (all fees that aren't optional or archived). */
  async refreshCharges(ctx: FinanceContext) {
    await requireFinanceEditor(ctx);
    const year = await feesRepository.findActiveYear();
    if (!year) return { charged: 0 };
    const fees = await feesRepository.findFees({ academicYearId: year.id, archived: false, optional: false });
    let charged = 0;
    for (const fee of fees) charged += await this.chargeMissing(fee);
    return { charged };
  }

  private async chargeMissing(fee: FeeRow): Promise<number> {
    const eligible = await this.eligible(fee);
    return this.charge(fee, eligible.map((e) => e.studentId), false);
  }

  /** Create charges (with each learner's discounts) for learners not yet charged. */
  private async charge(fee: FeeRow, studentIds: string[], mustBeEnrolled: boolean): Promise<number> {
    const unique = [...new Set(studentIds)];
    const enrolled = await feesRepository.findEnrolled(fee.academicYearId, { studentIds: unique });
    if (mustBeEnrolled && enrolled.length !== unique.length) {
      throw new ValidationError("Some of those learners aren't on a class list this year");
    }
    const already = new Set((await feesRepository.findChargesOfFee(fee.id)).map((c) => c.studentId));
    const todo = enrolled.map((e) => e.studentId).filter((id) => !already.has(id));
    if (todo.length === 0) return 0;
    const discounts = await feesRepository.findActiveDiscounts(todo, fee.academicYearId);
    const rows = todo.map((studentId) => {
      const d = discountFor(fee.amountNgwee, fee.category, discounts.filter((x) => x.studentId === studentId));
      return { feeId: fee.id, studentId, originalNgwee: fee.amountNgwee, discountNgwee: d, amountNgwee: fee.amountNgwee - d };
    });
    const r = await feesRepository.createCharges(rows);
    return r.count;
  }

  private async yearFor(termId: string | null) {
    if (termId) {
      const term = await feesRepository.findTerm(termId);
      if (!term) throw new NotFoundError("Term not found");
      return { academicYearId: term.academicYearId };
    }
    const year = await feesRepository.findActiveYear();
    if (!year) throw new ValidationError("There's no active academic year");
    return { academicYearId: year.id };
  }

  // ── Discounts and bursaries ──────────────────────────────────────────────

  async listDiscounts(ctx: FinanceContext, studentId?: string | null) {
    await financeAccess(ctx);
    const rows = await feesRepository.findDiscounts(studentId ? { studentId } : {});
    return rows.map((d) => ({
      id: d.id,
      studentId: d.studentId,
      learner: fullName(d.student),
      learnerNumber: d.student.learnerNumber,
      year: d.academicYear.year,
      name: d.name,
      kind: d.kind,
      value: d.value,
      categories: d.categories,
      reason: d.reason,
      createdAt: d.createdAt,
      endedAt: d.endedAt,
    }));
  }

  async createDiscount(ctx: FinanceContext, input: CreateDiscountInput) {
    const access = await requireFinanceEditor(ctx);
    const year = await feesRepository.findActiveYear();
    if (!year) throw new ValidationError("There's no active academic year");
    const student = await feesRepository.findStudent(input.studentId);
    if (!student) throw new NotFoundError("Learner not found");
    const discount = await feesRepository.createDiscount({
      studentId: input.studentId,
      academicYearId: year.id,
      name: input.name,
      kind: input.kind,
      value: input.value,
      categories: input.categories,
      reason: input.reason || null,
      createdById: ctx.userId,
    });
    const changed = await this.recalculateDiscounts(input.studentId, year.id);
    await auditService.record({
      action: "FEE_DISCOUNT",
      targetType: "SCHOOL",
      targetId: discount.id,
      schoolId: access.school.id,
      summary: `Discount "${input.name}" (${input.kind === "PERCENT" ? `${input.value}%` : formatKwacha(input.value)}) given to a learner`,
    });
    return { id: discount.id, chargesUpdated: changed };
  }

  async endDiscount(ctx: FinanceContext, id: string) {
    const access = await requireFinanceEditor(ctx);
    const discount = await feesRepository.findDiscount(id);
    if (!discount) throw new NotFoundError("Discount not found");
    if (discount.endedAt) throw new ValidationError("This discount has already ended");
    await feesRepository.endDiscount(id);
    const changed = await this.recalculateDiscounts(discount.studentId, discount.academicYearId);
    await auditService.record({
      action: "FEE_DISCOUNT",
      targetType: "SCHOOL",
      targetId: id,
      schoolId: access.school.id,
      summary: `Discount "${discount.name}" ended`,
    });
    return { ended: true, chargesUpdated: changed };
  }

  /** Re-work the discount on each of the learner's charges in the year. */
  private async recalculateDiscounts(studentId: string, academicYearId: string): Promise<number> {
    const [charges, discounts] = await Promise.all([
      feesRepository.findLearnerChargesInYear(studentId, academicYearId),
      feesRepository.findActiveDiscounts([studentId], academicYearId),
    ]);
    const updates = charges
      .map((c) => {
        const d = discountFor(c.originalNgwee, c.fee.category, discounts);
        return { id: c.id, originalNgwee: c.originalNgwee, discountNgwee: d, amountNgwee: c.originalNgwee - d, changed: d !== c.discountNgwee };
      })
      .filter((u) => u.changed)
      .map((u) => ({ id: u.id, originalNgwee: u.originalNgwee, discountNgwee: u.discountNgwee, amountNgwee: u.amountNgwee }));
    await feesRepository.updateCharges(updates);
    return updates.length;
  }
}

export function today(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function fullName(s: { firstName: string; middleName: string | null; lastName: string }): string {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
}

function presentFee(f: FeeRow, totals: { charged: number; paid: number }) {
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    description: f.description,
    academicYear: f.academicYear.year,
    academicYearId: f.academicYearId,
    termId: f.termId,
    termLabel: f.term ? TERM_LABEL[f.term.termType] ?? f.term.termType : null,
    amountNgwee: f.amountNgwee,
    dueDate: f.dueDate,
    targetKind: f.targetKind,
    targets: f.targets.map((t) => (t.grade ? t.grade.name : t.class ? `${t.class.grade.name} ${t.class.name}` : "")),
    gradeIds: f.targets.map((t) => t.gradeId).filter(Boolean),
    classIds: f.targets.map((t) => t.classId).filter(Boolean),
    optional: f.optional,
    archived: f.archived,
    instalments: f.instalments,
    learners: f._count.charges,
    chargedNgwee: totals.charged,
    paidNgwee: totals.paid,
    outstandingNgwee: totals.charged - totals.paid,
  };
}

export const feeService = new FeeService();
