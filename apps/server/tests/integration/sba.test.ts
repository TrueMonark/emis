import { describe, it, expect, beforeEach } from "vitest";
import { Gender, Role } from "@prisma/client";
import { systemPrisma } from "@/lib/db/prisma";
import { GET as overview, POST as startSheet } from "@/api/sba/route";
import { GET as getSheet } from "@/api/sba/[id]/route";
import { PATCH as updateTasks } from "@/api/sba/[id]/tasks/route";
import { PUT as saveEntries } from "@/api/sba/[id]/entries/route";
import { POST as submitSheet } from "@/api/sba/[id]/submit/route";
import { POST as reviewSheet } from "@/api/sba/[id]/review/route";
import { POST as confirmSheet } from "@/api/sba/[id]/confirm/route";
import { POST as reopenSheet } from "@/api/sba/[id]/reopen/route";
import { GET as scoreSheet } from "@/api/sba/[id]/score-sheet/route";
import { GET as officeSba } from "@/api/office/sba/route";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  TEST_SCHOOL_ID,
  resetDb,
  createTestUser,
  createHODUser,
  createTestOfficeUser,
  createTestDistrict,
  createTestAcademicYear,
  createTestGrade,
  createTestClass,
  createTestStudent,
  createTestSubject,
  enrollTestStudent,
  assignSubjectTeacher,
} from "../helpers/db";

type Sheet = {
  data: {
    id: string;
    status: string;
    canEdit: boolean;
    canReview: boolean;
    canConfirm: boolean;
    tasks: { id: string; number: number; maxMarks: number }[];
    learners: { studentId: string; total: { score: number; outOf: number; complete: boolean } }[];
    incomplete: number;
    events: { action: string }[];
  };
};

/**
 * Phase 9b (4 November 2026): SBA score sheets: each teacher's own sheet per subject and class,
 * six tasks out of what the teacher sets; teacher → HOD → head; offices see counts only.
 */
describe("SBA score sheets", () => {
  let teacherToken: string;
  let otherTeacherToken: string;
  let hodToken: string;
  let headToken: string;
  let debsToken: string;
  let classId: string;
  let subjectId: string;
  let studentIds: string[];

  beforeEach(async () => {
    await resetDb();
    const districtId = (await createTestDistrict("office-prov-lusaka", "SBA District")).id;
    await systemPrisma.school.update({ where: { id: TEST_SCHOOL_ID }, data: { districtOfficeId: districtId } });

    const teacher = await createTestUser({ role: Role.TEACHER });
    const other = await createTestUser({ role: Role.TEACHER });
    const hod = await createHODUser();
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const debs = await createTestOfficeUser(districtId);
    [teacherToken, otherTeacherToken, hodToken, headToken, debsToken] = await Promise.all(
      [teacher, other, hod, head, debs].map((u) => loginAs(u.user.email, u.password))
    );

    const year = await createTestAcademicYear({ year: new Date().getFullYear() });
    const grade = await createTestGrade({ name: "Form 2", level: null, stage: "O_LEVEL", curriculum: "CBC_2023", sequence: 2 });
    classId = (await createTestClass(grade.id)).id;
    subjectId = (await createTestSubject({ name: "Mathematics", departmentId: hod.department.id })).id;
    await assignSubjectTeacher(teacher.teacherProfile!.id, subjectId, classId, year.id);
    studentIds = [];
    for (const gender of [Gender.MALE, Gender.FEMALE]) {
      const s = await createTestStudent({ gender });
      await enrollTestStudent(s.id, classId, year.id);
      studentIds.push(s.id);
    }
  });

  const start = (token = teacherToken) =>
    callRoute<Sheet>(startSheet, { method: "POST", url: "/api/sba", token, body: { classId, subjectId } });
  const on = <T,>(handler: Parameters<typeof callRoute>[0], id: string, token: string, method = "POST", body?: unknown) =>
    callRoute<T>(handler, { method, url: `/api/sba/${id}`, token, params: { id }, body });

  /** Every learner gets a mark for every task (the first learner absent for task 6). */
  async function fillIn(sheet: Sheet["data"]) {
    const marks = studentIds.flatMap((sid, i) =>
      sheet.tasks.map((t) => ({ taskId: t.id, studentId: sid, marks: i === 0 && t.number === 6 ? null : 10 + t.number, isAbsent: i === 0 && t.number === 6 }))
    );
    return on<Sheet>(saveEntries, sheet.id, teacherToken, "PUT", {
      marks,
      notes: studentIds.map((sid, i) => ({ studentId: sid, examinationNumber: `260000${i}`, comment: "Good effort" })),
    });
  }

  it("a teacher starts a sheet for a subject they teach; six tasks out of 100 by default", async () => {
    const list = await callRoute<{ data: { mine: { sheet: unknown }[] } }>(overview, { url: "/api/sba", token: teacherToken });
    expect(list.json.data.mine).toHaveLength(1);
    expect(list.json.data.mine[0].sheet).toBeNull();

    const r = await start();
    expect(r.status).toBe(201);
    expect(r.json.data.tasks.map((t) => t.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.json.data.tasks.every((t) => t.maxMarks === 100)).toBe(true);
    expect(r.json.data.learners).toHaveLength(2);
    // Twice is refused; a teacher who doesn't teach it can't start one.
    expect((await start()).status).toBe(409);
    expect((await start(otherTeacherToken)).status).toBe(403);
  });

  it("marks must fit each task's maximum; a maximum can't drop below a mark already given", async () => {
    const sheet = (await start()).json.data;
    const t1 = sheet.tasks[0];
    const tasks = sheet.tasks.map((t) => ({ id: t.id, title: `Task ${t.number}`, maxMarks: 20 }));
    expect((await on(updateTasks, sheet.id, teacherToken, "PATCH", { tasks })).status).toBe(200);

    const tooHigh = await on(saveEntries, sheet.id, teacherToken, "PUT", { marks: [{ taskId: t1.id, studentId: studentIds[0], marks: 25, isAbsent: false }] });
    expect(tooHigh.status).toBe(422);
    expect((await on(saveEntries, sheet.id, teacherToken, "PUT", { marks: [{ taskId: t1.id, studentId: studentIds[0], marks: 18, isAbsent: false }] })).status).toBe(200);
    const lower = await on(updateTasks, sheet.id, teacherToken, "PATCH", { tasks: [{ id: t1.id, title: "Task 1", maxMarks: 15 }] });
    expect(lower.status).toBe(422);

    // Only the sheet's own teacher enters marks.
    expect((await on(saveEntries, sheet.id, hodToken, "PUT", { marks: [] })).status).toBe(403);
  });

  it("teacher → HOD (sent back, then approved) → head confirms; the history keeps every step", async () => {
    const sheet = (await start()).json.data;
    // Not complete yet.
    expect((await on(submitSheet, `${sheet.id}`, teacherToken)).status).toBe(422);

    const filled = await fillIn(sheet);
    expect(filled.status).toBe(200);
    expect(filled.json.data.incomplete).toBe(0);
    // Absent counts as 0 but the task still counts towards "out of".
    const first = filled.json.data.learners.find((l) => l.studentId === studentIds[0])!;
    expect(first.total).toMatchObject({ score: 11 + 12 + 13 + 14 + 15, outOf: 600, complete: true });

    expect((await on(submitSheet, sheet.id, teacherToken)).status).toBe(200);
    // With the HOD now: the teacher can't change it, another teacher can't see it.
    expect((await on(saveEntries, sheet.id, teacherToken, "PUT", { marks: [] })).status).toBe(403);
    expect((await on(getSheet, sheet.id, otherTeacherToken, "GET")).status).toBe(404);
    // The head can't confirm before the HOD approves.
    expect((await on(confirmSheet, sheet.id, headToken)).status).toBe(403);

    expect((await on(reviewSheet, sheet.id, hodToken, "POST", { decision: "RETURN" })).status).toBe(422);
    const back = await on<Sheet>(reviewSheet, sheet.id, hodToken, "POST", { decision: "RETURN", comment: "Check task 3" });
    expect(back.json.data.status).toBe("RETURNED");
    expect((await on(submitSheet, sheet.id, teacherToken)).status).toBe(200);
    const approved = await on<Sheet>(reviewSheet, sheet.id, hodToken, "POST", { decision: "APPROVE" });
    expect(approved.json.data.status).toBe("HOD_APPROVED");

    const confirmed = await on<Sheet>(confirmSheet, sheet.id, headToken);
    expect(confirmed.json.data.status).toBe("CONFIRMED");
    expect(confirmed.json.data.events.map((e) => e.action)).toEqual(["STARTED", "SUBMITTED", "RETURNED", "SUBMITTED", "HOD_APPROVED", "CONFIRMED"]);

    // Reopening: head only, with a reason.
    expect((await on(reopenSheet, sheet.id, hodToken, "POST", { comment: "Wrong" })).status).toBe(403);
    expect((await on(reopenSheet, sheet.id, headToken, "POST", { comment: "" })).status).toBe(422);
    const reopened = await on<Sheet>(reopenSheet, sheet.id, headToken, "POST", { comment: "Learner added late" });
    expect(reopened.json.data.status).toBe("RETURNED");
  });

  it("two submits at once: only one goes through", async () => {
    const sheet = (await start()).json.data;
    await fillIn(sheet);
    const [a, b] = await Promise.all([on(submitSheet, sheet.id, teacherToken), on(submitSheet, sheet.id, teacherToken)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);
    expect(await systemPrisma.sbaSheetEvent.count({ where: { action: "SUBMITTED" } })).toBe(1);
  });

  it("the printout carries the marks, totals and names; the DEBS sees counts only", async () => {
    const sheet = (await start()).json.data;
    await fillIn(sheet);
    const print = await on<{ data: { rows: { examinationNumber: string; currentTotal: number }[]; levels: { current: string; earlier: string | null }; teacher: { name: string } } }>(
      scoreSheet,
      sheet.id,
      teacherToken,
      "GET"
    );
    expect(print.status).toBe(200);
    expect(print.json.data.levels).toEqual({ current: "Form 2", earlier: null });
    expect(print.json.data.rows).toHaveLength(2);
    expect(print.json.data.rows.map((r) => r.examinationNumber).sort()).toEqual(["2600000", "2600001"]);

    const progress = await callRoute<{ data: { schools: { schoolId: string; expected: number; draft: number }[]; total: { expected: number } } }>(officeSba, {
      url: "/api/office/sba",
      token: debsToken,
    });
    expect(progress.status).toBe(200);
    expect(progress.json.data.schools.find((s) => s.schoolId === TEST_SCHOOL_ID)).toMatchObject({ expected: 1, draft: 1 });
    expect(JSON.stringify(progress.json.data)).not.toContain("Good effort");
  });

  it("every SBA table is kept apart per school by the database (row-level security)", async () => {
    const rows = await systemPrisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname::text, relrowsecurity FROM pg_class
      WHERE relname IN ('sba_sheets', 'sba_tasks', 'sba_marks', 'sba_learner_notes', 'sba_sheet_events')`;
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
