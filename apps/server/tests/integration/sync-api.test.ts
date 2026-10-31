import { describe, it, expect, beforeEach } from "vitest";
import { AssessmentStatus, AttendanceStatus, DayOfWeek, Role } from "@prisma/client";
import { GET as snapshot } from "@/api/sync/snapshot/route";
import { GET as changes } from "@/api/sync/changes/route";
import { POST as push } from "@/api/sync/push/route";
import prisma from "@/lib/db/prisma";
import { attendanceRecordService } from "@/features/attendance/attendanceRecord.service";
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
  createTestAssessment,
  createTestTimetableSlot,
  enrollTestStudent,
  assignClassTeacher,
  assignSubjectTeacher,
} from "../helpers/db";
import { isSchoolDayForTests } from "../helpers/dates";

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};
const latest = (test: (d: Date) => boolean, from = todayUtc()) => {
  let d = from;
  while (!test(d)) d = new Date(d.getTime() - DAY);
  return d;
};
const lastWeekday = () => latest(isSchoolDayForTests); // the latest school day (no weekend or public holiday)
const lastMonday = () => latest((d) => d.getUTCDay() === 1);
const lastSaturday = () => latest((d) => d.getUTCDay() === 6);

type Snap = { data: { cursor: string; scope: string; settings: { offlineDays: number }; data: Record<string, Record<string, unknown>[]> } };
type Changes = {
  data: {
    resyncRequired: boolean;
    reason?: string;
    cursor: string;
    scope: string;
    changes: { entity: string; id: string; op: "UPSERT" | "DELETE"; record?: Record<string, unknown> }[];
  };
};
type Push = { data: { results: { opId: string; status: string; duplicate?: boolean; error?: string; result?: Record<string, unknown> }[] } };

/**
 * Phase 5: the phone sync API — snapshot, changes since a cursor (with the rows), and pushed
 * operations applied once each, through the same services as the web, with conflict rules.
 */
describe("phone sync API", () => {
  let token: string;
  let headToken: string;
  let teacherProfileId: string;
  let headCtx: { userId: string; role: Role };
  let yearId: string;
  let termId: string;
  let classId: string;
  let otherClassId: string;
  let subjectId: string;
  let studentId: string;
  let slotId: string;

  beforeEach(async () => {
    await resetDb();
    const teacher = await createTestUser({ role: Role.TEACHER });
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    token = await loginAs(teacher.user.email, teacher.password);
    headToken = await loginAs(head.user.email, head.password);
    teacherProfileId = teacher.teacherProfile!.id;
    headCtx = { userId: head.user.id, role: Role.HEAD_TEACHER };

    const year = await createTestAcademicYear({ year: todayUtc().getUTCFullYear() });
    yearId = year.id;
    const term = await createTestTerm(year.id, {
      startDate: new Date(todayUtc().getTime() - 40 * DAY),
      endDate: new Date(todayUtc().getTime() + 40 * DAY),
    });
    termId = term.id;
    const grade = await createTestGrade();
    classId = (await createTestClass(grade.id, { name: "A" })).id;
    otherClassId = (await createTestClass(grade.id, { name: "B" })).id;
    subjectId = (await createTestSubject()).id;
    await assignClassTeacher(teacherProfileId, classId, year.id);
    await assignSubjectTeacher(teacherProfileId, subjectId, classId, year.id);
    slotId = (await createTestTimetableSlot(classId, subjectId, teacherProfileId, year.id, { dayOfWeek: DayOfWeek.MONDAY })).id;
    const student = await createTestStudent({ firstName: "Mine" });
    studentId = student.id;
    await enrollTestStudent(student.id, classId, year.id);
    const stranger = await createTestStudent({ firstName: "Stranger" });
    await enrollTestStudent(stranger.id, otherClassId, year.id);
  });

  const op = (opId: string, type: string, payload: unknown, madeAt?: Date) => ({ opId, type, payload, madeAt: madeAt?.toISOString() });
  const send = (operations: ReturnType<typeof op>[], t = token) =>
    callRoute<Push>(push, { method: "POST", url: "/api/sync/push", token: t, body: { deviceId: "test-phone", operations } });
  const pull = (cursor: string, scope: string) =>
    callRoute<Changes>(changes, { url: `/api/sync/changes?cursor=${encodeURIComponent(cursor)}&scope=${encodeURIComponent(scope)}`, token });

  it("the snapshot holds only the teacher's scope, with only the fields a phone needs", async () => {
    const snap = await callRoute<Snap>(snapshot, { url: "/api/sync/snapshot", token });
    expect(snap.status).toBe(200);
    const { data, cursor, scope, settings } = snap.json.data;
    expect(cursor).toMatch(/^-?\d+\.\d+$/);
    expect(scope.length).toBeGreaterThan(10);
    expect(settings.offlineDays).toBe(14);
    expect(data.students.map((s) => s.firstName)).toEqual(["Mine"]);
    expect(Object.keys(data.students[0]).sort()).toEqual(
      ["firstName", "gender", "id", "lastName", "learnerNumber", "middleName", "status", "version"].sort()
    );
    expect(data.classes.map((c) => c.id)).toEqual([classId]);
    expect(data.timetable_slots.map((s) => s.id)).toEqual([slotId]);

    // A school account without a teacher profile (e.g. a clerk) has nothing to sync.
    const clerk = await createTestUser({ role: Role.CLERK });
    const clerkToken = await loginAs(clerk.user.email, clerk.password);
    expect((await callRoute(snapshot, { url: "/api/sync/snapshot", token: clerkToken })).status).toBe(403);
  });

  it("changes since the cursor come with the rows; deletions as tombstones; a scope change asks for a new snapshot", async () => {
    const snap = (await callRoute<Snap>(snapshot, { url: "/api/sync/snapshot", token })).json.data;

    // The head marks today's register for my class on the web.
    const day = lastWeekday();
    await attendanceRecordService.bulkMarkAttendance(
      { classId, termId, date: day, records: [{ studentId, status: AttendanceStatus.ABSENT }] },
      headCtx
    );
    const first = await pull(snap.cursor, snap.scope);
    expect(first.json.data.resyncRequired).toBe(false);
    const mark = first.json.data.changes.find((c) => c.entity === "attendance_records");
    expect(mark).toMatchObject({ op: "UPSERT", record: { studentId, status: "ABSENT", version: 1 } });

    // Nothing new: an empty page.
    const second = await pull(first.json.data.cursor, first.json.data.scope);
    expect(second.json.data.changes).toHaveLength(0);

    // Deleted on the web: the phone gets a tombstone.
    await prisma.attendanceRecord.delete({ where: { id: mark!.id } });
    const third = await pull(second.json.data.cursor, second.json.data.scope);
    expect(third.json.data.changes).toEqual([{ entity: "attendance_records", id: mark!.id, op: "DELETE" }]);

    // A new class for the teacher: rows they never had come into scope, so: new snapshot.
    await assignSubjectTeacher(teacherProfileId, subjectId, otherClassId, yearId);
    const fourth = await pull(third.json.data.cursor, third.json.data.scope);
    expect(fourth.json.data.resyncRequired).toBe(true);
    expect((await pull("not-a-cursor", snap.scope)).json.data.resyncRequired).toBe(true);
  });

  it("pushed attendance is applied once per opId, and weekend registers are refused", async () => {
    const day = isoDay(lastWeekday());
    const markOp = op("op-attendance-0001", "attendance.mark", {
      classId,
      termId,
      date: day,
      records: [{ studentId, status: "PRESENT" }],
    });

    const r1 = await send([markOp]);
    expect(r1.status).toBe(200);
    expect(r1.json.data.results[0]).toMatchObject({ opId: "op-attendance-0001", status: "applied", result: { applied: 1 } });

    // The connection dropped and the phone sends it again: same answer, nothing applied twice.
    const r2 = await send([markOp]);
    expect(r2.json.data.results[0]).toMatchObject({ status: "applied", duplicate: true });
    const rows = await prisma.attendanceRecord.findMany({ where: { studentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(1);

    const weekend = await send([
      op("op-weekend-0001", "attendance.mark", { classId, termId, date: isoDay(lastSaturday()), records: [{ studentId, status: "PRESENT" }] }),
      op("op-unknown-0001", "attendance.wipe", {}),
      op("op-badpayload-01", "attendance.mark", { classId }),
    ]);
    const [w, u, b] = weekend.json.data.results;
    expect(w.status).toBe("rejected");
    expect(w.error).toMatch(/Saturday or Sunday/);
    expect(u).toMatchObject({ status: "rejected", error: 'Unknown operation "attendance.wipe"' });
    expect(b.status).toBe("rejected");
    expect(b.error).toMatch(/Invalid data/);
  });

  it("attendance conflicts: a mark changed on the server after the phone's change is kept", async () => {
    const day = lastWeekday();
    // Phone took the register in the morning (offline)…
    const madeAt = new Date(Date.now() - 60 * 60 * 1000);
    // …and later the head corrected it on the web.
    await attendanceRecordService.bulkMarkAttendance(
      { classId, termId, date: day, records: [{ studentId, status: AttendanceStatus.LATE }] },
      headCtx
    );
    const res = await send([
      op("op-conflict-0001", "attendance.mark", { classId, termId, date: isoDay(day), records: [{ studentId, status: "ABSENT" }] }, madeAt),
    ]);
    const result = res.json.data.results[0];
    expect(result.status).toBe("applied");
    expect(result.result).toMatchObject({ applied: 0, conflicts: [{ studentId, serverStatus: "LATE" }] });
    const row = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId } });
    expect(row.status).toBe("LATE");

    // A change made after the server's (phone saw version 1 and changed it just now) wins.
    const later = await send([
      op("op-conflict-0002", "attendance.mark", { classId, termId, date: isoDay(day), records: [{ studentId, status: "ABSENT", baseVersion: row.version }] }),
    ]);
    expect(later.json.data.results[0].result).toMatchObject({ applied: 1, conflicts: [] });
  });

  it("marks: entered while the window is open; refused once completed or after the window closes", async () => {
    const open = await createTestAssessment(subjectId, classId, termId, { status: AssessmentStatus.PUBLISHED, examType: "CAT", totalMarks: 50 });
    await prisma.assessmentWindow.create({
      data: { termId, examType: "CAT", opensAt: new Date(Date.now() - 2 * DAY), closesAt: new Date(Date.now() + 2 * DAY), createdBy: headCtx.userId },
    });
    const done = await createTestAssessment(subjectId, classId, termId, { status: AssessmentStatus.COMPLETED, examType: "CAT" });
    const late = await createTestAssessment(subjectId, classId, termId, { status: AssessmentStatus.PUBLISHED, examType: "MID" });
    await prisma.assessmentWindow.create({
      data: { termId, examType: "MID", opensAt: new Date(Date.now() - 9 * DAY), closesAt: new Date(Date.now() - DAY), createdBy: headCtx.userId },
    });

    const res = await send([
      op("op-marks-00001", "marks.enter", { assessmentId: open.id, results: [{ studentId, marksObtained: 41 }] }),
      op("op-marks-00002", "marks.enter", { assessmentId: done.id, results: [{ studentId, marksObtained: 41 }] }),
      op("op-marks-00003", "marks.enter", { assessmentId: late.id, results: [{ studentId, marksObtained: 41 }] }),
    ]);
    const [a, b, c] = res.json.data.results;
    expect(a).toMatchObject({ status: "applied", result: { applied: 1 } });
    expect(b.status).toBe("rejected");
    expect(b.error).toMatch(/completed/);
    expect(c.status).toBe("rejected");
    expect(c.error).toMatch(/window closed/);
    const result = await prisma.studentAssessmentResult.findFirstOrThrow({ where: { assessmentId: open.id } });
    expect(result.marksObtained).toBe(41);
  });

  it("lesson logs and weekend-class registers sync too", async () => {
    const special = await prisma.specialClass.create({
      data: {
        classId, subjectId, termId, teacherId: teacherProfileId, date: lastSaturday(), startTime: "08:00", endTime: "10:00",
        topic: "Revision", status: "APPROVED",
      },
    });
    const res = await send([
      op("op-lesson-00001", "lessonLog.save", { timetableSlotId: slotId, date: isoDay(lastMonday()), topic: "Fractions" }),
      op("op-special-0001", "specialClass.register", { specialClassId: special.id, records: [{ studentId, status: "PRESENT" }] }),
    ]);
    expect(res.json.data.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(await prisma.lessonLog.count({ where: { timetableSlotId: slotId } })).toBe(1);
    expect(await prisma.specialClassAttendance.count({ where: { specialClassId: special.id } })).toBe(1);

    // Another teacher's phone can't take that register.
    const other = await createTestUser({ role: Role.TEACHER });
    const otherToken = await loginAs(other.user.email, other.password);
    const denied = await send([op("op-special-0002", "specialClass.register", { specialClassId: special.id, records: [{ studentId, status: "ABSENT" }] })], otherToken);
    expect(denied.json.data.results[0].status).toBe("rejected");
    // The head can still push via the web; the phone's opIds are per person.
    expect((await send([op("op-lesson-00001", "lessonLog.save", { timetableSlotId: slotId, date: isoDay(lastMonday()), topic: "Fractions II" })], headToken)).json.data.results[0].duplicate).toBeUndefined();
  });
});
