import { describe, it, expect, beforeEach } from "vitest";
import { GradeLevel, Role } from "@prisma/client";
import { GET as options } from "@/api/finance/options/route";
import { GET as listFees, POST as createFee } from "@/api/finance/fees/route";
import { POST as termFees } from "@/api/finance/fees/term-fees/route";
import { PATCH as updateFee, DELETE as deleteFee } from "@/api/finance/fees/[id]/route";
import { POST as addLearners } from "@/api/finance/fees/[id]/learners/route";
import { DELETE as removeLearner } from "@/api/finance/fees/[id]/learners/[studentId]/route";
import { GET as account } from "@/api/finance/learners/[id]/route";
import { POST as recordPayment } from "@/api/finance/payments/route";
import { GET as receipt } from "@/api/finance/payments/[id]/route";
import { POST as voidPayment } from "@/api/finance/payments/[id]/void/route";
import { POST as createDiscount } from "@/api/finance/discounts/route";
import { POST as endDiscount } from "@/api/finance/discounts/[id]/end/route";
import { GET as classList } from "@/api/finance/reports/class-list/route";
import { GET as debtors } from "@/api/finance/reports/debtors/route";
import { GET as collections } from "@/api/finance/reports/collections/route";
import { GET as listStaff, POST as createStaff } from "@/api/finance/staff/route";
import { DELETE as endStaff } from "@/api/finance/staff/[id]/route";
import { POST as markAttendance } from "@/api/attendance/route";
import { GET as schoolIdentity } from "@/api/school/identity/route";
import { systemPrisma } from "@/lib/db/prisma";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  TEST_SCHOOL_ID,
  resetDb,
  createTestUser,
  createTestAcademicYear,
  createTestTerm,
  createTestGrade,
  createTestClass,
  createTestStudent,
  enrollTestStudent,
  createTestSchool,
} from "../helpers/db";

const DAY = 24 * 60 * 60 * 1000;
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromToday = (n: number) => iso(new Date(todayUtc().getTime() + n * DAY));
const K = (kwacha: number) => kwacha * 100;

type Account = {
  totals: { chargedNgwee: number; paidNgwee: number; balanceNgwee: number; overdueNgwee: number; creditNgwee: number };
  charges: { feeId: string; amountNgwee: number; paidNgwee: number; balanceNgwee: number; overdueNgwee: number; discountNgwee: number; status: string }[];
};

/**
 * School fees (requested 19 October 2026): private schools (or schools the DEBS switches on)
 * have finance staff who set up fees, record payments and print money reports; the head
 * teacher and deputy can view and print; nobody else sees it.
 */
describe("school fees", () => {
  let financeToken: string;
  let headToken: string;
  let teacherToken: string;
  let termId: string;
  let gradeA: string;
  let gradeB: string;
  let classA: string;
  let s1: string;
  let s2: string;
  let s3: string;
  let outsider: string;

  beforeEach(async () => {
    await resetDb();
    await systemPrisma.school.update({ where: { id: TEST_SCHOOL_ID }, data: { category: "PRIVATE", feesEnabled: true } });
    const finance = await createTestUser({ role: Role.FINANCE });
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const teacher = await createTestUser({ role: Role.TEACHER });
    financeToken = await loginAs(finance.user.email, finance.password);
    headToken = await loginAs(head.user.email, head.password);
    teacherToken = await loginAs(teacher.user.email, teacher.password);

    const year = await createTestAcademicYear({ year: todayUtc().getUTCFullYear() });
    const term = await createTestTerm(year.id, { startDate: new Date(todayUtc().getTime() - 30 * DAY), endDate: new Date(todayUtc().getTime() + 60 * DAY) });
    termId = term.id;
    const a = await createTestGrade({ level: GradeLevel.GRADE_8, name: "Grade 8", sequence: 8 });
    const b = await createTestGrade({ level: GradeLevel.GRADE_9, name: "Grade 9", sequence: 9 });
    gradeA = a.id;
    gradeB = b.id;
    classA = (await createTestClass(gradeA)).id;
    const classB = (await createTestClass(gradeB)).id;
    s1 = (await createTestStudent()).id;
    s2 = (await createTestStudent()).id;
    s3 = (await createTestStudent()).id;
    outsider = (await createTestStudent()).id; // not on a class list this year
    await enrollTestStudent(s1, classA, year.id);
    await enrollTestStudent(s2, classA, year.id);
    await enrollTestStudent(s3, classB, year.id);
  });

  const fee = (token: string, body: Record<string, unknown>) =>
    callRoute<{ data: { id: string; charged: number }; error?: string }>(createFee, {
      method: "POST",
      url: "/api/finance/fees",
      token,
      body: { category: "TUITION", termId, targetKind: "ALL", ...body },
    });
  const pay = (token: string, body: Record<string, unknown>) =>
    callRoute<{ data: { id: string; receiptNumber: string; balanceAfterNgwee: number }; error?: string }>(recordPayment, {
      method: "POST",
      url: "/api/finance/payments",
      token,
      body: { method: "CASH", paidOn: iso(todayUtc()), ...body },
    });
  const accountOf = async (studentId: string, token = financeToken) =>
    (await callRoute<{ data: Account }>(account, { url: `/api/finance/learners/${studentId}`, token, params: { id: studentId } })).json.data;

  it("finance staff edit, the head only views, everyone else is kept out", async () => {
    const asFinance = await callRoute<{ data: { canEdit: boolean } }>(options, { url: "/api/finance/options", token: financeToken });
    expect(asFinance.status).toBe(200);
    expect(asFinance.json.data.canEdit).toBe(true);

    const asHead = await callRoute<{ data: { canEdit: boolean } }>(options, { url: "/api/finance/options", token: headToken });
    expect(asHead.status).toBe(200);
    expect(asHead.json.data.canEdit).toBe(false);
    expect((await fee(headToken, { name: "Tuition", amountNgwee: K(1000), dueDate: daysFromToday(10) })).status).toBe(403);

    expect((await callRoute(options, { url: "/api/finance/options", token: teacherToken })).status).toBe(403);

    // Finance staff only reach the fees pages (and their own account, school name…).
    const elsewhere = await callRoute<{ error: string }>(markAttendance, { method: "POST", url: "/api/attendance", token: financeToken, body: {} });
    expect(elsewhere.status).toBe(403);
    expect(elsewhere.json.error).toMatch(/school fees/i);
    expect((await callRoute(schoolIdentity, { url: "/api/school/identity", token: financeToken })).status).toBe(200);

    // A school without the fees module: nobody gets in.
    await systemPrisma.school.update({ where: { id: TEST_SCHOOL_ID }, data: { feesEnabled: false } });
    const off = await callRoute<{ error: string }>(options, { url: "/api/finance/options", token: financeToken });
    expect(off.status).toBe(403);
    expect(off.json.error).toMatch(/aren't switched on/);
  });

  it("charges the right learners, applies discounts, and follows changes", async () => {
    const whole = await fee(financeToken, { name: "PTA levy", category: "DEVELOPMENT", amountNgwee: K(200), dueDate: daysFromToday(10) });
    expect(whole.status).toBe(201);
    expect(whole.json.data.charged).toBe(3); // not the learner who isn't on a class list

    // 10% off tuition for s1 (doesn't touch the PTA levy).
    const disc = await callRoute<{ data: { id: string } }>(createDiscount, {
      method: "POST",
      url: "/api/finance/discounts",
      token: financeToken,
      body: { studentId: s1, name: "Sibling discount", kind: "PERCENT", value: 10, categories: ["TUITION"] },
    });
    expect(disc.status).toBe(201);

    const tuition = await fee(financeToken, { name: "Tuition – Grade 8", amountNgwee: K(1000), dueDate: daysFromToday(10), targetKind: "YEAR_LEVELS", gradeIds: [gradeA] });
    expect(tuition.json.data.charged).toBe(2);
    let a1 = await accountOf(s1);
    expect(a1.charges.find((c) => c.feeId === tuition.json.data.id)!.amountNgwee).toBe(K(900));
    expect(a1.charges.find((c) => c.feeId === whole.json.data.id)!.amountNgwee).toBe(K(200));

    // Changing the fee changes every charge (less discounts).
    const changed = await callRoute(updateFee, {
      method: "PATCH",
      url: `/api/finance/fees/${tuition.json.data.id}`,
      token: financeToken,
      params: { id: tuition.json.data.id },
      body: { amountNgwee: K(2000) },
    });
    expect(changed.status).toBe(200);
    a1 = await accountOf(s1);
    expect(a1.charges.find((c) => c.feeId === tuition.json.data.id)!.amountNgwee).toBe(K(1800));
    expect((await accountOf(s2)).charges.find((c) => c.feeId === tuition.json.data.id)!.amountNgwee).toBe(K(2000));

    // Ending the discount puts the charge back up.
    await callRoute(endDiscount, { method: "POST", url: `/api/finance/discounts/${disc.json.data.id}/end`, token: financeToken, params: { id: disc.json.data.id } });
    a1 = await accountOf(s1);
    expect(a1.charges.find((c) => c.feeId === tuition.json.data.id)!.amountNgwee).toBe(K(2000));

    // A charged fee can't be deleted (archive instead).
    expect((await callRoute(deleteFee, { method: "DELETE", url: `/api/finance/fees/${tuition.json.data.id}`, token: financeToken, params: { id: tuition.json.data.id } })).status).toBe(409);

    // Term fees by year level: one fee per level.
    const tf = await callRoute<{ data: { created: number; charged: number } }>(termFees, {
      method: "POST",
      url: "/api/finance/fees/term-fees",
      token: financeToken,
      body: { termId, name: "Boarding", category: "BOARDING", dueDate: daysFromToday(20), amounts: [{ gradeId: gradeA, amountNgwee: K(3000) }, { gradeId: gradeB, amountNgwee: K(3500) }] },
    });
    expect(tf.status).toBe(201);
    expect(tf.json.data).toEqual({ created: 2, charged: 3 });
    const list = await callRoute<{ data: { name: string }[] }>(listFees, { url: "/api/finance/fees", token: headToken });
    expect(list.json.data.map((f) => f.name)).toContain("Boarding – Grade 9");
  });

  it("optional fees charge only the learners added", async () => {
    const trip = await fee(financeToken, { name: "Trip to Livingstone", category: "TRIP", amountNgwee: K(1200), dueDate: daysFromToday(20), targetKind: "LEARNERS" });
    expect(trip.json.data.charged).toBe(0);
    const tripId = trip.json.data.id;
    const add = (ids: string[]) =>
      callRoute<{ data: { charged: number } }>(addLearners, { method: "POST", url: `/api/finance/fees/${tripId}/learners`, token: financeToken, params: { id: tripId }, body: { studentIds: ids } });
    expect((await add([s3])).json.data.charged).toBe(1);
    expect((await add([s3])).json.data.charged).toBe(0); // already charged
    expect((await add([outsider])).status).toBe(422);

    // Paid towards → can't simply be removed.
    await pay(financeToken, { studentId: s3, amountNgwee: K(100), feeId: tripId });
    const removed = await callRoute(removeLearner, { method: "DELETE", url: `/api/finance/fees/${tripId}/learners/${s3}`, token: financeToken, params: { id: tripId, studentId: s3 } });
    expect(removed.status).toBe(409);
  });

  it("splits payments (earmarked first, then oldest), numbers receipts, and voids", async () => {
    const tuition = await fee(financeToken, { name: "Tuition", amountNgwee: K(1000), dueDate: daysFromToday(-10), targetKind: "CLASSES", classIds: [classA] });
    const trip = await fee(financeToken, { name: "Trip", category: "TRIP", amountNgwee: K(500), dueDate: daysFromToday(20), targetKind: "LEARNERS", studentIds: [s1] });

    // Overdue before anything is paid.
    let a = await accountOf(s1);
    expect(a.totals.overdueNgwee).toBe(K(1000));

    const r1 = await pay(financeToken, { studentId: s1, amountNgwee: K(700) });
    expect(r1.status).toBe(201);
    const year = todayUtc().getUTCFullYear();
    expect(r1.json.data.receiptNumber).toBe(`RCT-${year}-000001`);
    expect(r1.json.data.balanceAfterNgwee).toBe(K(800));

    const r2 = await pay(financeToken, { studentId: s1, amountNgwee: K(300), feeId: trip.json.data.id, method: "MOBILE_MONEY", reference: "MP26123456" });
    expect(r2.json.data.receiptNumber).toBe(`RCT-${year}-000002`);
    a = await accountOf(s1);
    const t = (id: string) => a.charges.find((c) => c.feeId === id)!;
    expect(t(tuition.json.data.id)).toMatchObject({ paidNgwee: K(700), balanceNgwee: K(300), overdueNgwee: K(300), status: "PART_PAID" });
    expect(t(trip.json.data.id)).toMatchObject({ paidNgwee: K(300), balanceNgwee: K(200) });

    // More than owed: the oldest first, then the trip, the rest is credit.
    const r3 = await pay(financeToken, { studentId: s1, amountNgwee: K(600) });
    a = await accountOf(s1);
    expect(t(tuition.json.data.id).status).toBe("PAID");
    expect(t(trip.json.data.id).status).toBe("PAID");
    expect(a.totals.creditNgwee).toBe(K(100));
    expect(a.totals.balanceNgwee).toBe(-K(100));

    // Rules: a reference for mobile money, no future dates, the learner must have that fee.
    expect((await pay(financeToken, { studentId: s1, amountNgwee: K(10), method: "MOBILE_MONEY" })).status).toBe(422);
    expect((await pay(financeToken, { studentId: s1, amountNgwee: K(10), paidOn: daysFromToday(2) })).status).toBe(422);
    expect((await pay(financeToken, { studentId: s2, amountNgwee: K(10), feeId: trip.json.data.id })).status).toBe(422);
    expect((await pay(headToken, { studentId: s1, amountNgwee: K(10) })).status).toBe(403);

    // Void: stays on record, stops counting; the head can't void, nor twice.
    const v = (token: string) =>
      callRoute(voidPayment, { method: "POST", url: `/api/finance/payments/${r3.json.data.id}/void`, token, params: { id: r3.json.data.id }, body: { reason: "Wrong learner" } });
    expect((await v(headToken)).status).toBe(403);
    expect((await v(financeToken)).status).toBe(200);
    expect((await v(financeToken)).status).toBe(422);
    a = await accountOf(s1);
    expect(a.totals.paidNgwee).toBe(K(1000));
    expect(a.totals.balanceNgwee).toBe(K(500));
    const printed = await callRoute<{ data: { status: string; voidReason: string } }>(receipt, { url: `/api/finance/payments/${r3.json.data.id}`, token: headToken, params: { id: r3.json.data.id } });
    expect(printed.json.data).toMatchObject({ status: "VOIDED", voidReason: "Wrong learner" });

    // The next receipt doesn't reuse the cancelled number.
    expect((await pay(financeToken, { studentId: s1, amountNgwee: K(50) })).json.data.receiptNumber).toBe(`RCT-${year}-000004`);
  });

  it("instalments: only the parts already due are overdue", async () => {
    await fee(financeToken, {
      name: "Tuition",
      amountNgwee: K(1000),
      dueDate: daysFromToday(30),
      targetKind: "CLASSES",
      classIds: [classA],
      instalments: [
        { label: "First half", dueDate: daysFromToday(-5), percent: 50 },
        { label: "Second half", dueDate: daysFromToday(30), percent: 50 },
      ],
    });
    expect((await accountOf(s2)).totals.overdueNgwee).toBe(K(500));
    const bad = await fee(financeToken, {
      name: "Bad plan",
      amountNgwee: K(1000),
      dueDate: daysFromToday(30),
      instalments: [{ label: "Only part", dueDate: daysFromToday(1), percent: 60 }],
    });
    expect(bad.status).toBe(422);
  });

  it("reports: class list with payments, who owes, money collected", async () => {
    const tuition = await fee(financeToken, { name: "Tuition", amountNgwee: K(1000), dueDate: daysFromToday(-1) });
    await pay(financeToken, { studentId: s1, amountNgwee: K(1000), method: "BANK_DEPOSIT", reference: "DEP-1" });
    await pay(financeToken, { studentId: s2, amountNgwee: K(400) });

    const cl = await callRoute<{ data: { columns: { feeId: string }[]; rows: { studentId: string; fees: { paidNgwee: number }[]; balanceNgwee: number }[] } }>(classList, {
      url: `/api/finance/reports/class-list?classId=${classA}`,
      token: headToken,
    });
    expect(cl.status).toBe(200);
    expect(cl.json.data.columns.map((c) => c.feeId)).toEqual([tuition.json.data.id]);
    expect(cl.json.data.rows).toHaveLength(2);
    expect(cl.json.data.rows.find((r) => r.studentId === s2)).toMatchObject({ fees: [{ paidNgwee: K(400) }], balanceNgwee: K(600) });

    const d = await callRoute<{ data: { rows: { studentId: string; balanceNgwee: number }[]; totals: { learners: number; balanceNgwee: number } } }>(debtors, {
      url: "/api/finance/reports/debtors",
      token: financeToken,
    });
    expect(d.json.data.rows.map((r) => r.studentId)).toEqual([s3, s2]); // largest first
    expect(d.json.data.totals).toMatchObject({ learners: 2, balanceNgwee: K(1600) });

    const c = await callRoute<{ data: { totals: { count: number; amountNgwee: number }; byMethod: { key: string; amountNgwee: number }[] } }>(collections, {
      url: `/api/finance/reports/collections?from=${daysFromToday(-1)}&to=${daysFromToday(0)}`,
      token: financeToken,
    });
    expect(c.json.data.totals).toEqual({ count: 2, amountNgwee: K(1400) });
    expect(c.json.data.byMethod.find((m) => m.key === "BANK_DEPOSIT")!.amountNgwee).toBe(K(1000));
  });

  it("another school's finance staff see none of this school's money", async () => {
    await fee(financeToken, { name: "Tuition", amountNgwee: K(1000), dueDate: daysFromToday(5) });
    await pay(financeToken, { studentId: s1, amountNgwee: K(100) });
    const other = await createTestSchool({ name: "Other Private School" });
    await systemPrisma.school.update({ where: { id: other.id }, data: { category: "PRIVATE", feesEnabled: true } });
    const theirs = await createTestUser({ role: Role.FINANCE, schoolId: other.id });
    const token = await loginAs(theirs.user.email, theirs.password);
    const list = await callRoute<{ data: unknown[] }>(listFees, { url: "/api/finance/fees", token });
    expect(list.status).toBe(200);
    expect(list.json.data).toEqual([]);
    const theirReceipt = await pay(token, { studentId: s1, amountNgwee: K(100) });
    expect(theirReceipt.status).toBe(404); // the learner isn't theirs
  });

  it("the head teacher makes and ends finance staff accounts", async () => {
    const made = await callRoute<{ data: { email: string; temporaryPassword: string } }>(createStaff, {
      method: "POST",
      url: "/api/finance/staff",
      token: headToken,
      body: { displayName: "Memory Tembo", email: "bursar@school.example" },
    });
    expect(made.status).toBe(201);
    expect(made.json.data.temporaryPassword).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const user = await systemPrisma.user.findUniqueOrThrow({ where: { email: "bursar@school.example" }, include: { schoolMemberships: true, profile: true } });
    expect(user).toMatchObject({ role: "FINANCE", hasDefaultPassword: true, profile: null });
    expect(user.schoolMemberships[0]).toMatchObject({ role: "FINANCE", status: "ACTIVE" });

    // Same email again; finance staff can't make accounts.
    expect((await callRoute(createStaff, { method: "POST", url: "/api/finance/staff", token: headToken, body: { displayName: "Someone Else", email: "bursar@school.example" } })).status).toBe(409);
    expect((await callRoute(createStaff, { method: "POST", url: "/api/finance/staff", token: financeToken, body: { displayName: "X Y", email: "x@school.example" } })).status).toBe(403);

    const staff = await callRoute<{ data: { membershipId: string; email: string }[] }>(listStaff, { url: "/api/finance/staff", token: headToken });
    const m = staff.json.data.find((s) => s.email === "bursar@school.example")!;
    expect((await callRoute(endStaff, { method: "DELETE", url: `/api/finance/staff/${m.membershipId}`, token: headToken, params: { id: m.membershipId } })).status).toBe(200);
    const after = await systemPrisma.schoolMembership.findUniqueOrThrow({ where: { id: m.membershipId } });
    expect(after.status).toBe("ENDED");
  });
});
