import { describe, it, expect, beforeEach } from "vitest";
import { Role, AttendanceStatus } from "@prisma/client";
import { POST as markAttendance } from "@/api/attendance/route";
import {
  GET as listCovers,
  POST as createCover,
} from "@/api/attendance/register-covers/route";
import { DELETE as cancelCover } from "@/api/attendance/register-covers/[id]/route";
import { GET as listCoverTeachers } from "@/api/attendance/register-covers/teachers/route";
import { GET as teacherClasses } from "@/api/teacher/classes/route";
import { GET as classStudents } from "@/api/teacher/classes/[classId]/students/route";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  resetDb,
  createTestUser,
  createTestSchool,
  createTestAcademicYear,
  createTestTerm,
  createTestGrade,
  createTestClass,
  createTestStudent,
  enrollTestStudent,
  assignClassTeacher,
} from "../helpers/db";
import { isSchoolDayForTests } from "../helpers/dates";

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

/**
 * The morning class register belongs to the class teacher. A class teacher (or the head/deputy)
 * can hand it to another teacher for a few days — a "register cover".
 */
describe("daily register and register covers", () => {
  let classTeacherToken: string;
  let coverToken: string;
  let outsiderToken: string;
  let headToken: string;
  let classTeacherProfileId: string;
  let coverProfileId: string;
  let classId: string;
  let termId: string;
  let studentId: string;
  const today = isoDay(todayUtc());
  const inThreeDays = isoDay(new Date(todayUtc().getTime() + 3 * DAY));
  // No register is taken on a weekend (Phase 5) or a public holiday (Phase 5b), so the register
  // day is the latest school day.
  const registerDay = (() => {
    let d = todayUtc();
    while (!isSchoolDayForTests(d)) d = new Date(d.getTime() - DAY);
    return isoDay(d);
  })();

  const takeRegister = (token: string, date = registerDay) =>
    callRoute(markAttendance, {
      method: "POST",
      url: "/api/attendance",
      token,
      body: {
        classId,
        termId,
        date,
        records: [{ studentId, status: AttendanceStatus.PRESENT }],
      },
    });

  const handOver = (token: string, body: Record<string, unknown> = {}) =>
    callRoute<{ data: { id: string } }>(createCover, {
      method: "POST",
      url: "/api/attendance/register-covers",
      token,
      body: {
        classId,
        teacherId: coverProfileId,
        startDate: registerDay,
        endDate: inThreeDays,
        reason: "Workshop in Lusaka",
        ...body,
      },
    });

  beforeEach(async () => {
    await resetDb();
    const classTeacher = await createTestUser({ role: Role.TEACHER });
    const cover = await createTestUser({ role: Role.TEACHER });
    const outsider = await createTestUser({ role: Role.TEACHER });
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    classTeacherToken = await loginAs(classTeacher.user.email, classTeacher.password);
    coverToken = await loginAs(cover.user.email, cover.password);
    outsiderToken = await loginAs(outsider.user.email, outsider.password);
    headToken = await loginAs(head.user.email, head.password);
    classTeacherProfileId = classTeacher.teacherProfile!.id;
    coverProfileId = cover.teacherProfile!.id;

    const academicYear = await createTestAcademicYear({ year: todayUtc().getUTCFullYear() });
    const term = await createTestTerm(academicYear.id, {
      startDate: new Date(todayUtc().getTime() - 30 * DAY),
      endDate: new Date(todayUtc().getTime() + 30 * DAY),
    });
    termId = term.id;
    const grade = await createTestGrade();
    const testClass = await createTestClass(grade.id);
    classId = testClass.id;
    const student = await createTestStudent();
    studentId = student.id;
    await enrollTestStudent(student.id, classId, academicYear.id);
    await assignClassTeacher(classTeacherProfileId, classId, academicYear.id);
  });

  it("only the class teacher (or head/deputy) can take the morning register", async () => {
    expect((await takeRegister(classTeacherToken)).status).toBe(201);
    expect((await takeRegister(headToken)).status).toBe(201);
    expect((await takeRegister(outsiderToken)).status).toBe(403);
    expect((await takeRegister(coverToken)).status).toBe(403);
  });

  it("a class teacher hands the register over; the cover teacher can take it and see the class", async () => {
    const created = await handOver(classTeacherToken);
    expect(created.status).toBe(201);

    expect((await takeRegister(coverToken)).status).toBe(201);
    // Still nobody else.
    expect((await takeRegister(outsiderToken)).status).toBe(403);

    const classes = await callRoute<{
      data: { registerCoverClasses: { id: string; coverEndDate: string }[] };
    }>(teacherClasses, { url: "/api/teacher/classes", token: coverToken });
    expect(classes.status).toBe(200);
    expect(classes.json.data.registerCoverClasses.map((c) => c.id)).toEqual([classId]);
    expect(classes.json.data.registerCoverClasses[0].coverEndDate.slice(0, 10)).toBe(inThreeDays);

    const students = await callRoute(classStudents, {
      url: `/api/teacher/classes/${classId}/students`,
      token: coverToken,
      params: { classId },
    });
    expect(students.status).toBe(200);

    const list = await callRoute<{ data: { id: string; teacher: { id: string } }[] }>(listCovers, {
      url: `/api/attendance/register-covers?classId=${classId}`,
      token: classTeacherToken,
    });
    expect(list.json.data.map((c) => c.teacher.id)).toEqual([coverProfileId]);
  });

  it("cancelling a cover takes the register back", async () => {
    const created = await handOver(classTeacherToken);
    const id = created.json.data.id;

    // A colleague can't cancel it; the class teacher can.
    const byOutsider = await callRoute(cancelCover, {
      method: "DELETE",
      url: `/api/attendance/register-covers/${id}`,
      token: outsiderToken,
      params: { id },
    });
    expect(byOutsider.status).toBe(403);
    const cancelled = await callRoute(cancelCover, {
      method: "DELETE",
      url: `/api/attendance/register-covers/${id}`,
      token: classTeacherToken,
      params: { id },
    });
    expect(cancelled.status).toBe(200);

    expect((await takeRegister(coverToken)).status).toBe(403);
  });

  it("only the class teacher or head/deputy can arrange a cover, with sensible dates", async () => {
    expect((await handOver(outsiderToken)).status).toBe(403);
    const listByOutsider = await callRoute(listCovers, {
      url: `/api/attendance/register-covers?classId=${classId}`,
      token: outsiderToken,
    });
    expect(listByOutsider.status).toBe(403);

    // Last day before first day; handing it to the class teacher themselves; too long.
    expect((await handOver(classTeacherToken, { startDate: inThreeDays, endDate: today })).status).toBe(400);
    expect((await handOver(classTeacherToken, { teacherId: classTeacherProfileId })).status).toBe(400);
    const farOff = isoDay(new Date(todayUtc().getTime() + 120 * DAY));
    expect((await handOver(classTeacherToken, { endDate: farOff })).status).toBe(400);
    // A date in the wrong format is caught at the API boundary (422, like every other route's
    // input check); the rules above are the service's own checks (400).
    expect((await handOver(classTeacherToken, { startDate: "15/10/2026" })).status).toBe(422);

    // The head can arrange it; a second overlapping cover is refused.
    expect((await handOver(headToken)).status).toBe(201);
    expect((await handOver(classTeacherToken)).status).toBe(409);
  });

  it("the picker lists the school's active teachers except the class teacher", async () => {
    const res = await callRoute<{ data: { id: string }[] }>(listCoverTeachers, {
      url: `/api/attendance/register-covers/teachers?classId=${classId}`,
      token: classTeacherToken,
    });
    expect(res.status).toBe(200);
    const ids = res.json.data.map((t) => t.id);
    expect(ids).toContain(coverProfileId);
    expect(ids).not.toContain(classTeacherProfileId);
  });

  it("another school can't see, arrange or cancel this school's covers", async () => {
    const created = await handOver(classTeacherToken);
    const id = created.json.data.id;

    const schoolB = (await createTestSchool({ id: "school-test-b", name: "Test School B" })).id;
    const headB = await createTestUser({ role: Role.HEAD_TEACHER, schoolId: schoolB });
    const headBToken = await loginAs(headB.user.email, headB.password);

    const list = await callRoute(listCovers, {
      url: `/api/attendance/register-covers?classId=${classId}`,
      token: headBToken,
    });
    expect(list.status).toBe(404);
    expect((await handOver(headBToken)).status).toBe(404);
    const cancel = await callRoute(cancelCover, {
      method: "DELETE",
      url: `/api/attendance/register-covers/${id}`,
      token: headBToken,
      params: { id },
    });
    expect(cancel.status).toBe(404);
  });
});
