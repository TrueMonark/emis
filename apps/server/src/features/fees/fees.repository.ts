import prisma from "@/lib/db/prisma";
import type { FeeCategory, FeePaymentMethod, FeeTargetKind, Prisma } from "@prisma/client";
import { requireSchoolId } from "@/lib/db/tenant";
import type { LedgerCharge, LedgerPayment } from "./ledger";

const chargeForLedger = {
  id: true,
  feeId: true,
  studentId: true,
  amountNgwee: true,
  originalNgwee: true,
  discountNgwee: true,
  createdAt: true,
  fee: { select: { dueDate: true, instalments: { select: { dueDate: true, percent: true } } } },
} satisfies Prisma.FeeChargeSelect;

type ChargeRow = Prisma.FeeChargeGetPayload<{ select: typeof chargeForLedger }>;
const toLedger = (c: ChargeRow): LedgerCharge => ({
  id: c.id,
  feeId: c.feeId,
  studentId: c.studentId,
  amountNgwee: c.amountNgwee,
  originalNgwee: c.originalNgwee,
  discountNgwee: c.discountNgwee,
  createdAt: c.createdAt,
  dueDate: c.fee.dueDate,
  instalments: c.fee.instalments,
});

export const feeListInclude = {
  term: { select: { id: true, termType: true } },
  academicYear: { select: { id: true, year: true } },
  targets: { select: { gradeId: true, classId: true, grade: { select: { name: true } }, class: { select: { name: true, grade: { select: { name: true } } } } } },
  instalments: { select: { id: true, label: true, dueDate: true, percent: true }, orderBy: { dueDate: "asc" } },
  _count: { select: { charges: true } },
} satisfies Prisma.FeeInclude;
export type FeeRow = Prisma.FeeGetPayload<{ include: typeof feeListInclude }>;

const studentBrief = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  learnerNumber: true,
  studentNumber: true,
} satisfies Prisma.StudentSelect;

/**
 * School fees data access (school-owned tables; row-level security keeps schools apart).
 * Thin: the rules are in the services.
 */
export class FeesRepository {
  findSchool() {
    return prisma.school.findUnique({
      where: { id: requireSchoolId() },
      select: { id: true, name: true, feesEnabled: true, category: true },
    });
  }

  // ── Reference data ───────────────────────────────────────────────────────
  findActiveYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true }, select: { id: true, year: true } });
  }
  findYears() {
    return prisma.academicYear.findMany({ select: { id: true, year: true, isActive: true }, orderBy: { year: "desc" } });
  }
  findTerms() {
    return prisma.term.findMany({
      select: { id: true, termType: true, startDate: true, endDate: true, isActive: true, academicYearId: true },
      orderBy: { startDate: "asc" },
    });
  }
  findTerm(id: string) {
    return prisma.term.findUnique({ where: { id }, select: { id: true, academicYearId: true, termType: true, startDate: true, endDate: true } });
  }
  findGrades() {
    return prisma.grade.findMany({ select: { id: true, name: true, sequence: true }, orderBy: { sequence: "asc" } });
  }
  findClasses() {
    return prisma.class.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, gradeId: true, grade: { select: { name: true, sequence: true } } },
      orderBy: [{ grade: { sequence: "asc" } }, { name: "asc" }],
    });
  }

  /** Learners on class lists in the year (who fees can be charged to), with their class. */
  findEnrolled(academicYearId: string, where: { classIds?: string[]; gradeIds?: string[]; studentIds?: string[] } = {}) {
    return prisma.studentClassEnrollment.findMany({
      where: {
        academicYearId,
        status: "ACTIVE",
        ...(where.classIds ? { classId: { in: where.classIds } } : {}),
        ...(where.gradeIds ? { class: { gradeId: { in: where.gradeIds } } } : {}),
        ...(where.studentIds ? { studentId: { in: where.studentIds } } : {}),
      },
      select: {
        studentId: true,
        classId: true,
        class: { select: { name: true, grade: { select: { name: true, sequence: true } } } },
        student: { select: studentBrief },
      },
    });
  }

  // ── Fees ─────────────────────────────────────────────────────────────────
  findFees(where: Prisma.FeeWhereInput) {
    return prisma.fee.findMany({ where, include: feeListInclude, orderBy: [{ dueDate: "asc" }, { name: "asc" }] });
  }
  findFee(id: string) {
    return prisma.fee.findUnique({ where: { id }, include: feeListInclude });
  }

  createFee(data: {
    name: string;
    category: FeeCategory;
    description: string | null;
    academicYearId: string;
    termId: string | null;
    amountNgwee: number;
    dueDate: Date;
    targetKind: FeeTargetKind;
    optional: boolean;
    createdById: string;
    targets: { gradeId?: string; classId?: string }[];
    instalments: { label: string; dueDate: Date; percent: number }[];
  }) {
    const { targets, instalments, ...fee } = data;
    return prisma.fee.create({
      data: { ...fee, targets: { create: targets }, instalments: { create: instalments } },
      include: feeListInclude,
    });
  }

  updateFee(
    id: string,
    data: { name?: string; description?: string | null; dueDate?: Date; amountNgwee?: number; archived?: boolean },
    instalments?: { label: string; dueDate: Date; percent: number }[]
  ) {
    return prisma.$transaction(async (tx) => {
      if (instalments) {
        await tx.feeInstalment.deleteMany({ where: { feeId: id } });
        if (instalments.length) await tx.feeInstalment.createMany({ data: instalments.map((i) => ({ ...i, feeId: id })) });
      }
      return tx.fee.update({ where: { id }, data, include: feeListInclude });
    });
  }

  deleteFee(id: string) {
    return prisma.fee.delete({ where: { id } });
  }

  // ── Charges ──────────────────────────────────────────────────────────────
  findChargesOfFee(feeId: string) {
    return prisma.feeCharge.findMany({ where: { feeId }, select: { id: true, studentId: true, originalNgwee: true, discountNgwee: true } });
  }

  createCharges(rows: { feeId: string; studentId: string; originalNgwee: number; discountNgwee: number; amountNgwee: number }[]) {
    if (rows.length === 0) return Promise.resolve({ count: 0 });
    return prisma.feeCharge.createMany({ data: rows, skipDuplicates: true });
  }

  updateCharges(rows: { id: string; originalNgwee: number; discountNgwee: number; amountNgwee: number }[]) {
    if (rows.length === 0) return Promise.resolve([]);
    return prisma.$transaction(
      rows.map(({ id, ...data }) => prisma.feeCharge.update({ where: { id }, data }))
    );
  }

  deleteCharge(feeId: string, studentId: string) {
    return prisma.feeCharge.delete({ where: { feeId_studentId: { feeId, studentId } } });
  }

  countEarmarkedPayments(feeId: string, studentId: string) {
    return prisma.feePayment.count({ where: { feeId, studentId, status: "RECORDED" } });
  }

  countPaymentsForFee(feeId: string) {
    return prisma.feePayment.count({ where: { feeId } });
  }

  /** A learner's charges in a year, with the fee's category (for recalculating discounts). */
  findLearnerChargesInYear(studentId: string, academicYearId: string) {
    return prisma.feeCharge.findMany({
      where: { studentId, fee: { academicYearId } },
      select: { id: true, originalNgwee: true, discountNgwee: true, amountNgwee: true, fee: { select: { category: true, amountNgwee: true } } },
    });
  }

  /** Charges and (recorded) payments for the ledger: of some learners, or of everyone. */
  async findLedger(studentIds?: string[]): Promise<{ charges: LedgerCharge[]; payments: LedgerPayment[] }> {
    const studentFilter = studentIds ? { studentId: { in: studentIds } } : {};
    const [charges, payments] = await Promise.all([
      prisma.feeCharge.findMany({ where: studentFilter, select: chargeForLedger }),
      prisma.feePayment.findMany({
        where: { ...studentFilter, status: "RECORDED" },
        select: { id: true, studentId: true, amountNgwee: true, feeId: true },
      }),
    ]);
    return { charges: charges.map(toLedger), payments };
  }

  /** Every fee by id (name, category, term) for labelling account lines. */
  findFeesByIds(ids: string[]) {
    return prisma.fee.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, category: true, termId: true, academicYearId: true, dueDate: true, optional: true, term: { select: { termType: true } }, academicYear: { select: { year: true } } },
    });
  }

  // ── Discounts ────────────────────────────────────────────────────────────
  findActiveDiscounts(studentIds: string[], academicYearId: string) {
    return prisma.feeDiscount.findMany({
      where: { studentId: { in: studentIds }, academicYearId, endedAt: null },
      select: { studentId: true, kind: true, value: true, categories: true },
    });
  }
  findDiscounts(where: Prisma.FeeDiscountWhereInput) {
    return prisma.feeDiscount.findMany({
      where,
      include: { student: { select: studentBrief }, academicYear: { select: { year: true } } },
      orderBy: [{ endedAt: "asc" }, { createdAt: "desc" }],
    });
  }
  findDiscount(id: string) {
    return prisma.feeDiscount.findUnique({ where: { id } });
  }
  createDiscount(data: Prisma.FeeDiscountUncheckedCreateInput) {
    return prisma.feeDiscount.create({ data });
  }
  endDiscount(id: string) {
    return prisma.feeDiscount.update({ where: { id }, data: { endedAt: new Date() } });
  }

  // ── Payments ─────────────────────────────────────────────────────────────
  findStudent(id: string) {
    return prisma.student.findUnique({
      where: { id },
      select: {
        ...studentBrief,
        studentGuardians: {
          where: { isPrimary: true },
          select: { guardian: { select: { firstName: true, lastName: true, phone: true } } },
          take: 1,
        },
      },
    });
  }

  findChargeForFee(feeId: string, studentId: string) {
    return prisma.feeCharge.findUnique({ where: { feeId_studentId: { feeId, studentId } }, select: { id: true } });
  }

  /** Records a payment with the next receipt number of the school and year (row-locked counter). */
  recordPayment(
    year: number,
    data: {
      studentId: string;
      amountNgwee: number;
      method: FeePaymentMethod;
      reference: string | null;
      payerName: string | null;
      paidOn: Date;
      feeId: string | null;
      notes: string | null;
      receivedById: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ last: number }[]>`
        INSERT INTO "fee_receipt_counters" ("year", "last") VALUES (${year}, 1)
        ON CONFLICT ("schoolId", "year") DO UPDATE SET "last" = "fee_receipt_counters"."last" + 1
        RETURNING "last"`;
      const receiptNumber = `RCT-${year}-${String(rows[0].last).padStart(6, "0")}`;
      return tx.feePayment.create({ data: { ...data, receiptNumber }, select: { id: true, receiptNumber: true } });
    });
  }

  findPayment(id: string) {
    return prisma.feePayment.findUnique({
      where: { id },
      include: { student: { select: studentBrief }, fee: { select: { name: true } } },
    });
  }

  findPayments(where: Prisma.FeePaymentWhereInput, take = 1000) {
    return prisma.feePayment.findMany({
      where,
      include: { student: { select: studentBrief }, fee: { select: { name: true } } },
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      take,
    });
  }

  voidPayment(id: string, voidedById: string, reason: string) {
    return prisma.feePayment.update({
      where: { id },
      data: { status: "VOIDED", voidReason: reason, voidedById, voidedAt: new Date() },
    });
  }

  findUserNames(ids: string[]) {
    return prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, email: true } });
  }

  // ── Finance staff ────────────────────────────────────────────────────────
  findFinanceStaff() {
    return prisma.schoolMembership.findMany({
      where: { schoolId: requireSchoolId(), role: "FINANCE" },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        user: { select: { id: true, email: true, phone: true, displayName: true, lastLogin: true, hasDefaultPassword: true } },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    });
  }

  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  createFinanceAccount(data: { email: string; phone: string | null; displayName: string; passwordHash: string; expiresAt: Date }) {
    return prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        displayName: data.displayName,
        passwordHash: data.passwordHash,
        role: "FINANCE",
        hasDefaultPassword: true,
        temporaryPasswordExpiresAt: data.expiresAt,
        schoolMemberships: { create: { schoolId: requireSchoolId(), role: "FINANCE", status: "ACTIVE" } },
      },
      select: { id: true, email: true, displayName: true, schoolMemberships: { select: { id: true } } },
    });
  }

  findMembership(id: string) {
    return prisma.schoolMembership.findFirst({
      where: { id, schoolId: requireSchoolId() },
      select: { id: true, role: true, status: true, userId: true, user: { select: { displayName: true, email: true } } },
    });
  }

  endMembership(id: string) {
    return prisma.schoolMembership.update({ where: { id }, data: { status: "ENDED", endDate: new Date(), endReason: "LEFT" } });
  }
}

export const feesRepository = new FeesRepository();
