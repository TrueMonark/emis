import { describe, it, expect, beforeEach } from "vitest";
import { AssessmentStatus, Role } from "@prisma/client";
import { POST as enterResults } from "@/api/assessments/[id]/results/route";
import { GET as history } from "@/api/assessments/[id]/history/route";
import { POST as push } from "@/api/sync/push/route";
import prisma from "@/lib/db/prisma";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  resetDb,
  createTestUser,
  createHODUser,
  createTestAcademicYear,
  createTestTerm,
  createTestGrade,
  createTestClass,
  createTestStudent,
  createTestSubject,
  createTestAssessment,
  enrollTestStudent,
  assignSubjectTeacher,
} from "../helpers/db";

const DAY = 24 * 60 * 60 * 1000;
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

type Change = { studentId: string; action: string; oldMarks: number | null; newMarks: number | null; source: string; changedBy: string; note: string | null };
type History = { data: { changes: Change[] } };
type Push = { data: { results: { status: string; error?: string; result?: { applied: number; conflicts: { studentId: string; serverMarks: number }[] } }[] } };

/**
 * Phase 5b (requested 21 October 2026): every mark entered or changed, on the web or from a
 * phone, is kept with who and when; a phone's older change doesn't silently overwrite a newer one.
 */
describe("marks history", () => {
  let teacherToken: string;
  let otherToken: string;
  let headToken: string;
  let hodToken: string;
  let assessmentId: string;
  let studentId: string;

  beforeEach(async () => {
    await resetDb();
    const teacher = await createTestUser({ role: Role.TEACHER });
    const other = await createTestUser({ role: Role.TEACHER });
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const hod = await createHODUser();
    teacherToken = await loginAs(teacher.user.email, teacher.password);
    otherToken = await loginAs(other.user.email, other.password);
    headToken = await loginAs(head.user.email, head.password);
    hodToken = await loginAs(hod.user.email, hod.password);

    const year = await createTestAcademicYear({ year: todayUtc().getUTCFullYear() });
    const term = await createTestTerm(year.id, {
      startDate: new Date(todayUtc().getTime() - 40 * DAY),
      endDate: new Date(todayUtc().getTime() + 40 * DAY),
    });
    const grade = await createTestGrade();
    const klass = await createTestClass(grade.id);
    const subject = await createTestSubject({ departmentId: hod.department.id });
    await assignSubjectTeacher(teacher.teacherProfile!.id, subject.id, klass.id, year.id);
    const student = await createTestStudent();
    studentId = student.id;
    await enrollTestStudent(student.id, klass.id, year.id);
    assessmentId = (await createTestAssessment(subject.id, klass.id, term.id, { status: AssessmentStatus.PUBLISHED, totalMarks: 50 })).id;
    await prisma.assessmentWindow.create({
      data: { termId: term.id, examType: "CAT", opensAt: new Date(Date.now() - 2 * DAY), closesAt: new Date(Date.now() + 2 * DAY), createdBy: head.user.id },
    });
  });

  const enter = (marks: number, token = teacherToken) =>
    callRoute(enterResults, {
      method: "POST",
      url: `/api/assessments/${assessmentId}/results`,
      token,
      params: { id: assessmentId },
      body: [{ studentId, marksObtained: marks }],
    });
  const changes = async (token = teacherToken) =>
    callRoute<History>(history, { url: `/api/assessments/${assessmentId}/history?studentId=${studentId}`, token, params: { id: assessmentId } });

  it("keeps every entry and change on the web, with who made it", async () => {
    expect((await enter(30)).status).toBe(201);
    expect((await enter(35)).status).toBe(201);
    expect((await enter(35)).status).toBe(201); // same mark again: nothing new to record

    const h = await changes();
    expect(h.status).toBe(200);
    expect(h.json.data.changes.map((c) => [c.action, c.oldMarks, c.newMarks, c.source])).toEqual([
      ["CHANGED", 30, 35, "WEB"],
      ["CREATED", null, 30, "WEB"],
    ]);
    expect(h.json.data.changes[0].changedBy).toBe("Test Teacher");

    // The HOD of the subject and the head can see it; a teacher who doesn't teach it can't.
    expect((await changes(hodToken)).status).toBe(200);
    expect((await changes(headToken)).status).toBe(200);
    expect((await changes(otherToken)).status).toBe(403);

    // A deleted result stays in the history.
    await prisma.studentAssessmentResult.deleteMany({ where: { assessmentId } });
    expect((await changes()).json.data.changes[0]).toMatchObject({ action: "DELETED", oldMarks: 35 });
  });

  it("from a phone: applied changes are marked PHONE; an older phone change doesn't overwrite a newer mark", async () => {
    await enter(40); // on the web, now
    const row = await prisma.studentAssessmentResult.findFirstOrThrow({ where: { assessmentId } });

    // Made on the phone an hour ago, before the web entry, without having seen it.
    const stale = await callRoute<Push>(push, {
      method: "POST",
      url: "/api/sync/push",
      token: teacherToken,
      body: {
        deviceId: "test-phone",
        operations: [
          {
            opId: "op-marks-stale-1",
            type: "marks.enter",
            madeAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            payload: { assessmentId, results: [{ studentId, marksObtained: 12 }] },
          },
        ],
      },
    });
    expect(stale.json.data.results[0].result).toMatchObject({ applied: 0, conflicts: [{ studentId, serverMarks: 40 }] });
    expect((await prisma.studentAssessmentResult.findFirstOrThrow({ where: { assessmentId } })).marksObtained).toBe(40);

    // Made now, having seen the web mark: applied, recorded as from the phone.
    const fresh = await callRoute<Push>(push, {
      method: "POST",
      url: "/api/sync/push",
      token: teacherToken,
      body: {
        deviceId: "test-phone",
        operations: [{ opId: "op-marks-fresh-1", type: "marks.enter", payload: { assessmentId, results: [{ studentId, marksObtained: 44, baseVersion: row.version }] } }],
      },
    });
    expect(fresh.json.data.results[0].result).toMatchObject({ applied: 1, conflicts: [] });

    const h = (await changes()).json.data.changes;
    expect(h.map((c) => [c.action, c.oldMarks, c.newMarks, c.source])).toEqual([
      ["CHANGED", 40, 44, "PHONE"],
      ["PHONE_NOT_APPLIED", 40, 12, "PHONE"],
      ["CREATED", null, 40, "WEB"],
    ]);
    expect(h[1].note).toMatch(/kept/);
  });
});
