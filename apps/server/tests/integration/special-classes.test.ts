import { describe, it, expect, beforeEach } from "vitest";
import { AttendanceStatus, Role } from "@prisma/client";
import { POST as markAttendance } from "@/api/attendance/route";
import { GET as listSpecial, POST as createSpecial } from "@/api/special-classes/route";
import { POST as approve } from "@/api/special-classes/[id]/approve/route";
import { POST as reject } from "@/api/special-classes/[id]/reject/route";
import { POST as cancel } from "@/api/special-classes/[id]/cancel/route";
import { GET as getRegister, PUT as saveRegister } from "@/api/special-classes/[id]/register/route";
import prisma from "@/lib/db/prisma";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  resetDb,
  createTestUser,
  createTestAcademicYear,
  createTestTerm,
  createTestGrade,
  createTestClass,
  createTestStudent,
  createTestSubject,
  createTestDepartment,
  enrollTestStudent,
  assignClassTeacher,
  assignSubjectTeacher,
} from "../helpers/db";

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};
/** The next Saturday after today (always in the future). */
const nextSaturday = () => {
  let d = new Date(todayUtc().getTime() + DAY);
  while (d.getUTCDay() !== 6) d = new Date(d.getTime() + DAY);
  return d;
};
/** The latest Saturday before today (always in the past). */
const lastSaturday = () => {
  let d = new Date(todayUtc().getTime() - DAY);
  while (d.getUTCDay() !== 6) d = new Date(d.getTime() - DAY);
  return d;
};
const nextMonday = () => {
  let d = new Date(todayUtc().getTime() + DAY);
  while (d.getUTCDay() !== 1) d = new Date(d.getTime() + DAY);
  return d;
};

type SC = { id: string; status: string; canDecide: boolean };

/**
 * Requested 18 October 2026: no attendance on a weekend, unless the teacher asked for a special
 * weekend class and their HOD approved it. Its register is the teacher's own and is kept apart
 * from the daily register.
 */
describe("weekend attendance and special classes", () => {
  let teacherToken: string;
  let otherTeacherToken: string;
  let hodToken: string;
  let otherHodToken: string;
  let headToken: string;
  let teacherProfileId: string;
  let classId: string;
  let subjectId: string;
  let termId: string;
  let studentId: string;

  beforeEach(async () => {
    await resetDb();
    const teacher = await createTestUser({ role: Role.TEACHER });
    const otherTeacher = await createTestUser({ role: Role.TEACHER });
    const hod = await createTestUser({ role: Role.TEACHER });
    const otherHod = await createTestUser({ role: Role.TEACHER });
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    teacherToken = await loginAs(teacher.user.email, teacher.password);
    otherTeacherToken = await loginAs(otherTeacher.user.email, otherTeacher.password);
    hodToken = await loginAs(hod.user.email, hod.password);
    otherHodToken = await loginAs(otherHod.user.email, otherHod.password);
    headToken = await loginAs(head.user.email, head.password);
    teacherProfileId = teacher.teacherProfile!.id;

    const sciences = await createTestDepartment({ name: "Sciences", hodTeacherId: hod.teacherProfile!.id });
    await createTestDepartment({ name: "Languages", hodTeacherId: otherHod.teacherProfile!.id });
    const year = await createTestAcademicYear({ year: todayUtc().getUTCFullYear() });
    const term = await createTestTerm(year.id, {
      startDate: new Date(todayUtc().getTime() - 40 * DAY),
      endDate: new Date(todayUtc().getTime() + 40 * DAY),
    });
    termId = term.id;
    const grade = await createTestGrade();
    const klass = await createTestClass(grade.id);
    classId = klass.id;
    const subject = await createTestSubject({ departmentId: sciences.id });
    subjectId = subject.id;
    await assignSubjectTeacher(teacherProfileId, subjectId, classId, year.id);
    await assignClassTeacher(otherTeacher.teacherProfile!.id, classId, year.id);
    const student = await createTestStudent();
    studentId = student.id;
    await enrollTestStudent(student.id, classId, year.id);
  });

  const ask = (token: string, overrides: Record<string, unknown> = {}) =>
    callRoute<{ data: SC; error?: string }>(createSpecial, {
      method: "POST",
      url: "/api/special-classes",
      token,
      body: {
        classId,
        subjectId,
        date: isoDay(nextSaturday()),
        startTime: "08:00",
        endTime: "10:00",
        topic: "Revision: chemical bonding",
        ...overrides,
      },
    });

  it("refuses the daily register on a weekend", async () => {
    const res = await callRoute<{ error: string }>(markAttendance, {
      method: "POST",
      url: "/api/attendance",
      token: otherTeacherToken, // the class teacher
      body: { classId, termId, date: isoDay(lastSaturday()), records: [{ studentId, status: AttendanceStatus.PRESENT }] },
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/Saturday or Sunday/);
  });

  it("a teacher asks, the subject's HOD approves (others can't), and the request rules hold", async () => {
    // Weekdays aren't special classes; you must teach the subject in that class.
    expect((await ask(teacherToken, { date: isoDay(nextMonday()) })).status).toBe(422);
    expect((await ask(otherTeacherToken)).status).toBe(403);
    expect((await ask(teacherToken, { startTime: "10:00", endTime: "09:00" })).status).toBe(422);

    const asked = await ask(teacherToken);
    expect(asked.status).toBe(201);
    expect(asked.json.data.status).toBe("PENDING");
    const id = asked.json.data.id;
    // The same class can't have two overlapping special classes that day.
    expect((await ask(teacherToken, { startTime: "09:00", endTime: "11:00" })).status).toBe(409);

    // The HOD got a notification and sees it to approve; the other department's HOD doesn't.
    const notes = await prisma.notification.findMany({ where: { relatedEntityType: "SPECIAL_CLASS" } });
    expect(notes).toHaveLength(1);
    const forHod = await callRoute<{ data: SC[] }>(listSpecial, { url: "/api/special-classes?view=to-approve", token: hodToken });
    expect(forHod.json.data.map((s) => [s.id, s.canDecide])).toEqual([[id, true]]);
    const forOtherHod = await callRoute<{ data: SC[] }>(listSpecial, { url: "/api/special-classes?view=to-approve", token: otherHodToken });
    expect(forOtherHod.json.data).toHaveLength(0);

    const decide = (handler: typeof approve, token: string) =>
      callRoute(handler, { method: "POST", url: `/api/special-classes/${id}/x`, token, params: { id }, body: {} });
    expect((await decide(approve, otherHodToken)).status).toBe(403);
    expect((await decide(approve, teacherToken)).status).toBe(403); // not their own
    expect((await decide(approve, hodToken)).status).toBe(200);
    expect((await decide(reject, headToken)).status).toBe(422); // already decided

    // Before the day, its register doesn't open yet.
    const early = await callRoute<{ error: string }>(saveRegister, {
      method: "PUT",
      url: `/api/special-classes/${id}/register`,
      token: teacherToken,
      params: { id },
      body: { records: [{ studentId, status: "PRESENT" }] },
    });
    expect(early.status).toBe(403);
    expect(early.json.error).toMatch(/opens on the day/);

    // Withdrawing works while no register has been taken.
    expect((await callRoute(cancel, { method: "POST", url: `/api/special-classes/${id}/cancel`, token: teacherToken, params: { id } })).status).toBe(200);
  });

  it("on the day, only the teacher who asked (or the head) takes the register of an approved class", async () => {
    const approvedId = (
      await prisma.specialClass.create({
        data: {
          classId, subjectId, termId, teacherId: teacherProfileId, date: lastSaturday(), startTime: "08:00", endTime: "10:00",
          topic: "Practical: titration", status: "APPROVED",
        },
      })
    ).id;
    const pendingId = (
      await prisma.specialClass.create({
        data: {
          classId, subjectId, termId, teacherId: teacherProfileId, date: lastSaturday(), startTime: "11:00", endTime: "12:00",
          topic: "Extra lesson", status: "PENDING",
        },
      })
    ).id;
    const save = (id: string, token: string) =>
      callRoute<{ error?: string }>(saveRegister, {
        method: "PUT",
        url: `/api/special-classes/${id}/register`,
        token,
        params: { id },
        body: { records: [{ studentId, status: "PRESENT" }] },
      });

    expect((await save(pendingId, teacherToken)).status).toBe(403); // not approved yet
    expect((await save(approvedId, otherTeacherToken)).status).toBe(403); // not theirs
    expect((await save(approvedId, teacherToken)).status).toBe(200);
    expect((await save(approvedId, headToken)).status).toBe(200); // correction by the head

    const register = await callRoute<{ data: { students: { id: string; status: string }[]; canTakeRegister: boolean } }>(getRegister, {
      url: `/api/special-classes/${approvedId}/register`,
      token: otherTeacherToken, // the class teacher can look, not take
      params: { id: approvedId },
    });
    expect(register.status).toBe(200);
    expect(register.json.data.canTakeRegister).toBe(false);
    expect(register.json.data.students).toEqual([expect.objectContaining({ id: studentId, status: "PRESENT" })]);

    // Kept apart from the daily register (report-card attendance is unchanged).
    expect(await prisma.attendanceRecord.count()).toBe(0);
    // It can't be cancelled once its register is taken.
    expect((await callRoute(cancel, { method: "POST", url: `/api/special-classes/${approvedId}/cancel`, token: teacherToken, params: { id: approvedId } })).status).toBe(422);
  });

  it("the head's own weekend class needs no approval", async () => {
    const res = await ask(headToken);
    expect(res.status).toBe(201);
    expect(res.json.data.status).toBe("APPROVED");
  });
});
