import { describe, it, expect, beforeEach } from "vitest";
import { AttendanceStatus, Role } from "@prisma/client";
import { zambianPublicHolidays, easterSunday } from "@school/shared/calendar/zambia-holidays";
import { POST as markAttendance } from "@/api/attendance/route";
import { GET as schoolCalendar } from "@/api/calendar/route";
import { GET as nonSchoolDays } from "@/api/calendar/non-school-days/route";
import { POST as addClosure } from "@/api/calendar/closures/route";
import { DELETE as removeClosure } from "@/api/calendar/closures/[id]/route";
import { GET as nationalHolidays, POST as changeHoliday } from "@/api/office/public-holidays/route";
import { DELETE as undoHolidayChange } from "@/api/office/public-holidays/[id]/route";
import { POST as askSpecialClass } from "@/api/special-classes/route";
import { GET as snapshot } from "@/api/sync/snapshot/route";
import { callRoute } from "../helpers/callRoute";
import { loginAs } from "../helpers/auth";
import {
  resetDb,
  createTestUser,
  createTestOfficeUser,
  createTestAcademicYear,
  createTestTerm,
  createTestGrade,
  createTestClass,
  createTestStudent,
  createTestSubject,
  enrollTestStudent,
  assignClassTeacher,
  assignSubjectTeacher,
  createTestSchool,
} from "../helpers/db";
import { isSchoolDayForTests } from "../helpers/dates";

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};
/** The latest school day before today. */
const pastSchoolDay = () => {
  let d = new Date(todayUtc().getTime() - DAY);
  while (!isSchoolDayForTests(d)) d = new Date(d.getTime() - DAY);
  return d;
};
/** The first school day at least two days ahead. */
const futureSchoolDay = () => {
  let d = new Date(todayUtc().getTime() + 2 * DAY);
  while (!isSchoolDayForTests(d)) d = new Date(d.getTime() + DAY);
  return d;
};

/**
 * Phase 5b (requested 21 October 2026): no registers on public holidays or days the school is
 * closed, like weekends. HQ keeps the national list up to date; the head teacher adds closures.
 */
describe("public holidays and school closures", () => {
  let classTeacherToken: string;
  let headToken: string;
  let hqToken: string;
  let peoToken: string;
  let classId: string;
  let subjectId: string;
  let termId: string;
  let studentId: string;

  beforeEach(async () => {
    await resetDb();
    const teacher = await createTestUser({ role: Role.TEACHER });
    const head = await createTestUser({ role: Role.HEAD_TEACHER });
    const hq = await createTestOfficeUser("office-hq");
    const peo = await createTestOfficeUser("office-prov-lusaka");
    classTeacherToken = await loginAs(teacher.user.email, teacher.password);
    headToken = await loginAs(head.user.email, head.password);
    hqToken = await loginAs(hq.user.email, hq.password);
    peoToken = await loginAs(peo.user.email, peo.password);

    const year = await createTestAcademicYear({ year: todayUtc().getUTCFullYear() });
    termId = (
      await createTestTerm(year.id, {
        startDate: new Date(todayUtc().getTime() - 40 * DAY),
        endDate: new Date(todayUtc().getTime() + 40 * DAY),
      })
    ).id;
    const grade = await createTestGrade();
    classId = (await createTestClass(grade.id)).id;
    subjectId = (await createTestSubject()).id;
    await assignClassTeacher(teacher.teacherProfile!.id, classId, year.id);
    await assignSubjectTeacher(teacher.teacherProfile!.id, subjectId, classId, year.id);
    const student = await createTestStudent();
    studentId = student.id;
    await enrollTestStudent(student.id, classId, year.id);
  });

  const takeRegister = (date: Date) =>
    callRoute<{ error?: string }>(markAttendance, {
      method: "POST",
      url: "/api/attendance",
      token: classTeacherToken,
      body: { classId, termId, date: isoDay(date), records: [{ studentId, status: AttendanceStatus.PRESENT }] },
    });
  const declare = (token: string, body: Record<string, unknown>) =>
    callRoute<{ data: { id: string }; error?: string }>(changeHoliday, { method: "POST", url: "/api/office/public-holidays", token, body });

  it("knows Zambia's public holidays, including the moving ones", () => {
    const h2026 = new Map(zambianPublicHolidays(2026).map((h) => [h.date, h.name]));
    expect(isoDay(easterSunday(2026))).toBe("2026-04-05");
    expect(h2026.get("2026-04-03")).toBe("Good Friday");
    expect(h2026.get("2026-04-06")).toBe("Easter Monday");
    expect(h2026.get("2026-03-09")).toBe("International Women's Day (observed)"); // 8 March 2026 is a Sunday
    expect(h2026.get("2026-07-06")).toBe("Heroes' Day");
    expect(h2026.get("2026-07-07")).toBe("Unity Day");
    expect(h2026.get("2026-08-03")).toBe("Farmers' Day");
    expect(h2026.get("2026-10-24")).toBe("Independence Day");
    expect(h2026.get("2026-12-29")).toBe("National Day of Prayer and Christian Heritage");
    expect(h2026.has("2026-10-18")).toBe(false); // moved to 29 December from 2026
    expect(h2026.has("2026-10-19")).toBe(false);
    expect(zambianPublicHolidays(2025).some((h) => h.date === "2025-10-18")).toBe(true);
    expect(isoDay(easterSunday(2027))).toBe("2027-03-28");
  });

  it("a holiday HQ declares stops registers; undoing it allows them again", async () => {
    const day = pastSchoolDay();
    expect((await declare(peoToken, { date: isoDay(day), kind: "ADD", name: "Day of national mourning" })).status).toBe(403);
    const declared = await declare(hqToken, { date: isoDay(day), kind: "ADD", name: "Day of national mourning" });
    expect(declared.status).toBe(201);
    expect((await declare(hqToken, { date: isoDay(day), kind: "ADD", name: "Again" })).status).toBe(409);

    const refused = await takeRegister(day);
    expect(refused.status).toBe(400);
    expect(refused.json.error).toMatch(/Day of national mourning \(a public holiday\)/);

    const list = await callRoute<{ data: { date: string; kind: string; name: string }[] }>(nonSchoolDays, {
      url: `/api/calendar/non-school-days?from=${isoDay(day)}&to=${isoDay(day)}`,
      token: classTeacherToken,
    });
    expect(list.json.data).toEqual([{ date: isoDay(day), kind: "PUBLIC_HOLIDAY", name: "Day of national mourning" }]);

    // The PEO can see it but not change it.
    const asPeo = await callRoute<{ data: { canEdit: boolean; holidays: { date: string }[] } }>(nationalHolidays, {
      url: `/api/office/public-holidays?year=${day.getUTCFullYear()}`,
      token: peoToken,
    });
    expect(asPeo.json.data.canEdit).toBe(false);
    expect(asPeo.json.data.holidays.map((h) => h.date)).toContain(isoDay(day));

    const id = declared.json.data.id;
    expect((await callRoute(undoHolidayChange, { method: "DELETE", url: `/api/office/public-holidays/${id}`, token: hqToken, params: { id } })).status).toBe(200);
    expect((await takeRegister(day)).status).toBe(201);
  });

  it("HQ cancels a built-in holiday; only real holidays can be cancelled, and only new days added", async () => {
    const year = todayUtc().getUTCFullYear();
    expect((await declare(hqToken, { date: `${year}-12-25`, kind: "ADD", name: "Christmas" })).status).toBe(422);
    expect((await declare(hqToken, { date: `${year}-12-23`, kind: "CANCEL", name: "Not a holiday" })).status).toBe(422);
    expect((await declare(hqToken, { date: `${year}-12-25`, kind: "CANCEL", name: "Christmas Day" })).status).toBe(201);
    const cal = await callRoute<{ data: { publicHolidays: { date: string }[]; canEdit: boolean } }>(schoolCalendar, {
      url: `/api/calendar?year=${year}`,
      token: classTeacherToken,
    });
    expect(cal.status).toBe(200);
    expect(cal.json.data.canEdit).toBe(false);
    expect(cal.json.data.publicHolidays.map((h) => h.date)).not.toContain(`${year}-12-25`);
    expect(cal.json.data.publicHolidays.map((h) => h.date)).toContain(`${year}-10-24`);
  });

  it("the head teacher closes the school for some days; registers stop on them", async () => {
    const day = pastSchoolDay();
    expect((await takeRegister(day)).status).toBe(201);

    const body = { name: "Mid-term break", startDate: isoDay(day), endDate: isoDay(day) };
    expect((await callRoute(addClosure, { method: "POST", url: "/api/calendar/closures", token: classTeacherToken, body })).status).toBe(403);
    const closed = await callRoute<{ data: { id: string; registerDaysAlreadyTaken: number } }>(addClosure, {
      method: "POST",
      url: "/api/calendar/closures",
      token: headToken,
      body,
    });
    expect(closed.status).toBe(201);
    expect(closed.json.data.registerDaysAlreadyTaken).toBe(1);
    expect(
      (await callRoute(addClosure, { method: "POST", url: "/api/calendar/closures", token: headToken, body: { ...body, endDate: isoDay(new Date(day.getTime() - DAY)) } })).status
    ).toBe(422);

    const refused = await takeRegister(day);
    expect(refused.status).toBe(400);
    expect(refused.json.error).toMatch(/school is closed \(Mid-term break\)/);

    const id = closed.json.data.id;
    expect((await callRoute(removeClosure, { method: "DELETE", url: `/api/calendar/closures/${id}`, token: headToken, params: { id } })).status).toBe(200);
    expect((await takeRegister(day)).status).toBe(201);
  });

  it("one school's closures don't close another school", async () => {
    const day = pastSchoolDay();
    await callRoute(addClosure, { method: "POST", url: "/api/calendar/closures", token: headToken, body: { name: "Water cut", startDate: isoDay(day), endDate: isoDay(day) } });
    const other = await createTestSchool({ name: "Other School" });
    const otherHead = await createTestUser({ role: Role.HEAD_TEACHER, schoolId: other.id });
    const token = await loginAs(otherHead.user.email, otherHead.password);
    const list = await callRoute<{ data: unknown[] }>(nonSchoolDays, { url: `/api/calendar/non-school-days?from=${isoDay(day)}&to=${isoDay(day)}`, token });
    expect(list.json.data).toEqual([]);
  });

  it("a special class can be held on a holiday, and phones get the holidays", async () => {
    const day = futureSchoolDay();
    const ask = () =>
      callRoute<{ error?: string }>(askSpecialClass, {
        method: "POST",
        url: "/api/special-classes",
        token: classTeacherToken,
        body: { classId, subjectId, date: isoDay(day), startTime: "08:00", endTime: "10:00", topic: "Revision" },
      });
    expect((await ask()).status).toBe(422); // an ordinary school day
    await declare(hqToken, { date: isoDay(day), kind: "ADD", name: "Election day" });
    expect((await ask()).status).toBe(201);

    const snap = await callRoute<{ data: { calendar: { nonSchoolDays: { date: string; name: string }[] } } }>(snapshot, {
      url: "/api/sync/snapshot",
      token: classTeacherToken,
    });
    expect(snap.json.data.calendar.nonSchoolDays).toContainEqual(expect.objectContaining({ date: isoDay(day), name: "Election day" }));
  });
});
