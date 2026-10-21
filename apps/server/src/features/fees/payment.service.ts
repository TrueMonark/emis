import { NotFoundError, ValidationError } from "@/lib/http/errors";
import { normalizeToUtcMidnight } from "@/lib/utils/date-utils";
import { METHODS_NEEDING_REFERENCE, PAYMENT_METHOD_LABELS, formatKwacha } from "@school/shared/fees/money";
import { auditService } from "@/features/audit/audit.service";
import { feesRepository } from "./fees.repository";
import { financeAccess, requireFinanceEditor, type FinanceContext } from "./financeAccess";
import { fullName, today } from "./fee.service";
import type { RecordPaymentInput } from "./fees.validation";

type PaymentRow = NonNullable<Awaited<ReturnType<typeof feesRepository.findPayment>>>;

/**
 * Payments (school fees). Every payment gets the next receipt number (RCT-2026-000123); a wrong
 * payment is cancelled ("voided") with a reason, never deleted, so the receipt book has no gaps.
 *
 * `source` is "MANUAL" for payments typed in by finance staff. A future bank or mobile-money
 * link would record payments with its own source and the provider's reference.
 */
export class PaymentService {
  async record(ctx: FinanceContext, input: RecordPaymentInput) {
    const access = await requireFinanceEditor(ctx);
    const student = await feesRepository.findStudent(input.studentId);
    if (!student) throw new NotFoundError("Learner not found");
    const reference = input.reference?.trim() || null;
    if ((METHODS_NEEDING_REFERENCE as readonly string[]).includes(input.method) && !reference) {
      throw new ValidationError(`Enter the reference for a ${PAYMENT_METHOD_LABELS[input.method].toLowerCase()} payment (slip, transaction or cheque number)`);
    }
    const paidOn = normalizeToUtcMidnight(input.paidOn);
    if (paidOn > today()) throw new ValidationError("The payment date can't be in the future");
    if (input.feeId && !(await feesRepository.findChargeForFee(input.feeId, input.studentId))) {
      throw new ValidationError("This learner hasn't been charged that fee");
    }
    const payment = await feesRepository.recordPayment(paidOn.getUTCFullYear(), {
      studentId: input.studentId,
      amountNgwee: input.amountNgwee,
      method: input.method,
      reference,
      payerName: input.payerName?.trim() || null,
      paidOn,
      feeId: input.feeId || null,
      notes: input.notes?.trim() || null,
      receivedById: ctx.userId,
    });
    await auditService.record({
      action: "PAYMENT_RECORDED",
      targetType: "SCHOOL",
      targetId: payment.id,
      schoolId: access.school.id,
      summary: `Receipt ${payment.receiptNumber}: ${formatKwacha(input.amountNgwee)} by ${PAYMENT_METHOD_LABELS[input.method]}`,
    });
    return this.receipt(ctx, payment.id);
  }

  async void(ctx: FinanceContext, id: string, reason: string) {
    const access = await requireFinanceEditor(ctx);
    const payment = await feesRepository.findPayment(id);
    if (!payment) throw new NotFoundError("Payment not found");
    if (payment.status === "VOIDED") throw new ValidationError("This payment has already been cancelled");
    await feesRepository.voidPayment(id, ctx.userId, reason);
    await auditService.record({
      action: "PAYMENT_VOIDED",
      targetType: "SCHOOL",
      targetId: id,
      schoolId: access.school.id,
      summary: `Receipt ${payment.receiptNumber} (${formatKwacha(payment.amountNgwee)}) cancelled: ${reason}`,
    });
    return { voided: true };
  }

  async list(
    ctx: FinanceContext,
    filter: { from?: string | null; to?: string | null; method?: string | null; studentId?: string | null; q?: string | null; includeVoided?: boolean }
  ) {
    await financeAccess(ctx);
    const q = filter.q?.trim();
    const rows = await feesRepository.findPayments({
      ...(filter.includeVoided ? {} : { status: "RECORDED" }),
      ...(filter.studentId ? { studentId: filter.studentId } : {}),
      ...(filter.method ? { method: filter.method as never } : {}),
      ...(filter.from || filter.to
        ? {
            paidOn: {
              ...(filter.from ? { gte: normalizeToUtcMidnight(filter.from) } : {}),
              ...(filter.to ? { lte: normalizeToUtcMidnight(filter.to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { receiptNumber: { contains: q, mode: "insensitive" as const } },
              { reference: { contains: q, mode: "insensitive" as const } },
              { student: { firstName: { contains: q, mode: "insensitive" as const } } },
              { student: { lastName: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    });
    const names = await this.names(rows);
    return rows.map((p) => presentPayment(p, names));
  }

  /** Everything a printed receipt shows. */
  async receipt(ctx: FinanceContext, id: string) {
    const access = await financeAccess(ctx);
    const payment = await feesRepository.findPayment(id);
    if (!payment) throw new NotFoundError("Payment not found");
    const [names, { charges, payments }, enrolled] = await Promise.all([
      this.names([payment]),
      feesRepository.findLedger([payment.studentId]),
      feesRepository.findActiveYear().then((y) => (y ? feesRepository.findEnrolled(y.id, { studentIds: [payment.studentId] }) : [])),
    ]);
    const charged = charges.reduce((s, c) => s + c.amountNgwee, 0);
    const paid = payments.reduce((s, p) => s + p.amountNgwee, 0);
    const e = enrolled[0];
    return {
      school: access.school,
      ...presentPayment(payment, names),
      classLabel: e ? `${e.class.grade.name} ${e.class.name}` : null,
      /** The learner's balance now (after this and every other payment) */
      balanceAfterNgwee: charged - paid,
    };
  }

  private async names(rows: PaymentRow[]) {
    const ids = [...new Set(rows.flatMap((p) => [p.receivedById, p.voidedById].filter((x): x is string => !!x)))];
    const users = await feesRepository.findUserNames(ids);
    return new Map(users.map((u) => [u.id, u.displayName || u.email]));
  }
}

function presentPayment(p: PaymentRow, names: Map<string, string>) {
  return {
    id: p.id,
    receiptNumber: p.receiptNumber,
    studentId: p.studentId,
    learner: fullName(p.student),
    learnerNumber: p.student.learnerNumber,
    amountNgwee: p.amountNgwee,
    method: p.method,
    methodLabel: PAYMENT_METHOD_LABELS[p.method] ?? p.method,
    reference: p.reference,
    payerName: p.payerName,
    paidOn: p.paidOn,
    feeId: p.feeId,
    feeName: p.fee?.name ?? null,
    notes: p.notes,
    source: p.source,
    status: p.status,
    receivedBy: names.get(p.receivedById) ?? null,
    recordedAt: p.createdAt,
    voidReason: p.voidReason,
    voidedBy: p.voidedById ? names.get(p.voidedById) ?? null : null,
    voidedAt: p.voidedAt,
  };
}

export const paymentService = new PaymentService();
