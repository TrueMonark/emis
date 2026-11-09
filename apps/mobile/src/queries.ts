import { isWeekend } from "@school/shared/calendar/weekend";
import { all, one, pendingWithPrefix, where, type Row } from "./db";
import { dayKeyOf, dayOf, type DayKey } from "./dates";
import { me, nonSchoolDays, storedAnnouncements, type PhoneAnnouncement } from "./sync";

/**
 * What the screens show, read from the phone's database: the server's rows with the phone's
 * own unsent changes on top. Field names follow docs/design/sync-api.md.
 */

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface Klass extends Row { name: string; gradeId: string; status: string }
interface Grade extends Row { name: string; shortName: string | null; sequence: number }
interface Subject extends Row { code: string; name: string }
export interface Student extends Row { firstName: string; middleName: string | null; lastName: string; learnerNumber: string | null; status: string; gender: string }
interface Enrolment extends Row { studentId: string; classId: string; academicYearId: string; status: string }
interface Assignment extends Row { teacherId: string; classId: string; subjectId?: string; academicYearId: string; endedAt: string | null }
export interface Slot extends Row { classId: string; subjectId: string; teacherId: string; dayOfWeek: DayKey; periodNumber: number; startTime: string; endTime: string; roomNumber: string | null; academicYearId: string }
interface Term extends Row { academicYearId: string; termType: string; startDate: string; endDate: string; isActive: boolean }
interface Year extends Row { year: number; isActive: boolean; isClosed: boolean }
export interface Assessment extends Row { title: string; subjectId: string; classId: string; termId: string; examType: string; totalMarks: number; passMark: number; assessmentDate: string | null; status: string }
export interface Result extends Row { studentId: string; assessmentId: string; marksObtained: number; isAbsent: boolean; remarks: string | null }
interface Attendance extends Row { studentId: string; classId: string; termId: string; timetableSlotId: string | null; date: string; status: AttendanceStatus; remarks: string | null }
interface LessonLog extends Row { timetableSlotId: string; date: string; topic: string; subtopics: string | null }
interface Cover extends Row { classId: string; teacherId: string; startDate: string; endDate: string; cancelledAt: string | null }
export interface SpecialClass extends Row { classId: string; subjectId: string; termId: string; teacherId: string; date: string; startTime: string; endTime: string; topic: string; venue: string | null; status: string }
interface SpecialAttendance extends Row { specialClassId: string; studentId: string; status: AttendanceStatus }

export const teacherId = () => me()?.teacherProfileId ?? "";

export const activeYear = () => all<Year>("academic_years").find((y) => y.isActive) ?? null;

/** The term a day falls in (this year), or the active one. */
export function termFor(day: string): Term | null {
  const terms = all<Term>("terms");
  return terms.find((t) => dayOf(t.startDate) <= day && day <= dayOf(t.endDate)) ?? null;
}
export const activeTerm = () => all<Term>("terms").find((t) => t.isActive) ?? null;
export const termLabel = (t: Term | null) => (t ? t.termType.replace("TERM_", "Term ") : "");

// ── classes, subjects, learners ──────────────────────────────────────────

export function classLabel(classId: string): string {
  const c = one<Klass>("classes", classId);
  if (!c) return "Class";
  const g = one<Grade>("grades", c.gradeId);
  return `${g?.name ?? ""} ${c.name}`.trim();
}
export const subjectName = (subjectId: string) => one<Subject>("subjects", subjectId)?.name ?? "Subject";

export const studentName = (s: Student) => [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

/** Learners on the class list this year, A–Z by surname. */
export function learnersOf(classId: string): Student[] {
  const year = activeYear();
  const ids = where<Enrolment>("student_class_enrollments", "classId", classId)
    .filter((e) => e.status === "ACTIVE" && (!year || e.academicYearId === year.id))
    .map((e) => e.studentId);
  return ids
    .map((id) => one<Student>("students", id))
    .filter((s): s is Student => !!s && (s.status === "ACTIVE" || s.status === "SUSPENDED"))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

/** Classes whose daily register is mine: as class teacher, or by a register cover on that day. */
export function myRegisterClasses(day: string): { classId: string; label: string; cover: boolean }[] {
  const me = teacherId();
  const year = activeYear();
  const own = all<Assignment>("class_teacher_assignments", (a) => a.teacherId === me && !a.endedAt && (!year || a.academicYearId === year.id)).map(
    (a) => a.classId
  );
  const covers = all<Cover>("register_covers", (c) => c.teacherId === me && !c.cancelledAt && dayOf(c.startDate) <= day && day <= dayOf(c.endDate)).map(
    (c) => c.classId
  );
  const out = new Map<string, boolean>();
  own.forEach((id) => out.set(id, false));
  covers.forEach((id) => (out.has(id) ? null : out.set(id, true)));
  return [...out.entries()].map(([classId, cover]) => ({ classId, cover, label: classLabel(classId) })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Classes and subjects I teach this year (for marks). */
export function myTeaching(): { classId: string; subjectId: string }[] {
  const me = teacherId();
  return all<Assignment>("subject_teacher_assignments", (a) => a.teacherId === me && !a.endedAt).map((a) => ({ classId: a.classId, subjectId: a.subjectId! }));
}

/** Every class I'm linked to (class teacher or subject teacher). */
export function myClasses(): { classId: string; label: string; learners: number; roles: string[] }[] {
  const me = teacherId();
  const map = new Map<string, Set<string>>();
  for (const a of all<Assignment>("class_teacher_assignments", (x) => x.teacherId === me && !x.endedAt)) (map.get(a.classId) ?? map.set(a.classId, new Set()).get(a.classId)!).add("Class teacher");
  for (const a of myTeaching()) (map.get(a.classId) ?? map.set(a.classId, new Set()).get(a.classId)!).add(subjectName(a.subjectId));
  return [...map.entries()]
    .map(([classId, roles]) => ({ classId, label: classLabel(classId), learners: learnersOf(classId).length, roles: [...roles] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ── timetable ────────────────────────────────────────────────────────────

export function mySlots(day?: DayKey): Slot[] {
  const me = teacherId();
  const year = activeYear();
  return all<Slot>("timetable_slots", (s) => s.teacherId === me && (!year || s.academicYearId === year.id) && (!day || s.dayOfWeek === day)).sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.periodNumber - b.periodNumber
  );
}
export const slotById = (id: string) => one<Slot>("timetable_slots", id);

// ── school days ──────────────────────────────────────────────────────────

/** Why there's no register on this day (weekend, public holiday, closure), or null. */
export function noSchoolReason(day: string): string | null {
  if (isWeekend(day)) return dayKeyOf(day) === "SATURDAY" ? "Saturday" : "Sunday";
  const hit = nonSchoolDays().find((d) => d.date === day);
  if (!hit) return null;
  return `${hit.name} (${hit.kind === "PUBLIC_HOLIDAY" ? "public holiday" : "school closed"})`;
}

// ── attendance ───────────────────────────────────────────────────────────

export interface Mark {
  status: AttendanceStatus;
  remarks?: string | null;
  version?: number;
  /** Saved on the phone, not yet accepted by the server */
  waiting?: boolean;
}

export const attendanceKey = (classId: string, day: string, slotId: string | null, studentId = "") =>
  `att|${classId}|${day}|${slotId ?? "daily"}|${studentId}`;

/** The marks of a register (server's, with the phone's waiting changes on top). */
export function registerMarks(classId: string, day: string, slotId: string | null): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const r of where<Attendance>("attendance_records", "classId", classId)) {
    if (dayOf(r.date) === day && (r.timetableSlotId ?? null) === slotId) out.set(r.studentId, { status: r.status, remarks: r.remarks, version: r.version });
  }
  const prefix = attendanceKey(classId, day, slotId);
  for (const [key, value] of pendingWithPrefix<Mark>(prefix)) {
    const studentId = key.slice(prefix.length);
    out.set(studentId, { ...value, version: out.get(studentId)?.version, waiting: true });
  }
  return out;
}

// ── marks ────────────────────────────────────────────────────────────────

export interface Score {
  marksObtained: number;
  isAbsent: boolean;
  version?: number;
  waiting?: boolean;
}

export function myAssessments(): Assessment[] {
  const teaching = new Set(myTeaching().map((t) => `${t.classId}|${t.subjectId}`));
  return all<Assessment>("assessments", (a) => teaching.has(`${a.classId}|${a.subjectId}`) && (a.status === "PUBLISHED" || a.status === "COMPLETED")).sort(
    (a, b) => (b.assessmentDate ?? "").localeCompare(a.assessmentDate ?? "") || a.title.localeCompare(b.title)
  );
}
export const assessmentById = (id: string) => one<Assessment>("assessments", id);

export const markKey = (assessmentId: string, studentId = "") => `mark|${assessmentId}|${studentId}`;

export function scoresOf(assessmentId: string): Map<string, Score> {
  const out = new Map<string, Score>();
  for (const r of where<Result>("student_assessment_results", "assessmentId", assessmentId)) {
    out.set(r.studentId, { marksObtained: r.marksObtained, isAbsent: r.isAbsent, version: r.version });
  }
  const prefix = markKey(assessmentId);
  for (const [key, value] of pendingWithPrefix<Score>(prefix)) {
    const studentId = key.slice(prefix.length);
    out.set(studentId, { ...value, version: out.get(studentId)?.version, waiting: true });
  }
  return out;
}

// ── lesson logs ──────────────────────────────────────────────────────────

export const logKey = (slotId: string, day: string) => `log|${slotId}|${day}`;

export function lessonLog(slotId: string, day: string): { topic: string; subtopics: string | null; waiting: boolean } | null {
  const waiting = pendingWithPrefix<{ topic: string; subtopics: string | null }>(logKey(slotId, day)).get(logKey(slotId, day));
  if (waiting) return { ...waiting, waiting: true };
  const saved = where<LessonLog>("lesson_logs", "timetableSlotId", slotId).find((l) => dayOf(l.date) === day);
  return saved ? { topic: saved.topic, subtopics: saved.subtopics, waiting: false } : null;
}

// ── special (weekend / holiday) classes ──────────────────────────────────

export const mySpecialClasses = () =>
  all<SpecialClass>("special_classes", (s) => s.teacherId === teacherId()).sort((a, b) => b.date.localeCompare(a.date));
export const specialClassById = (id: string) => one<SpecialClass>("special_classes", id);

export const specialKey = (specialClassId: string, studentId = "") => `sca|${specialClassId}|${studentId}`;

export function specialMarks(specialClassId: string): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const r of where<SpecialAttendance>("special_class_attendance", "specialClassId", specialClassId)) out.set(r.studentId, { status: r.status });
  const prefix = specialKey(specialClassId);
  for (const [key, value] of pendingWithPrefix<Mark>(prefix)) out.set(key.slice(prefix.length), { ...value, waiting: true });
  return out;
}

// ── Announcements (Phase 9c) ───────────────────────────────────────────────

export const announcementReadKey = (id: string) => `ann-read|${id}`;
export const announcementAckKey = (id: string) => `ann-ack|${id}`;

/**
 * Announcements as the phone knows them: what the last sync brought, plus what was opened or
 * acknowledged here and not sent yet.
 */
export function announcements(): (PhoneAnnouncement & { ackWaiting: boolean })[] {
  const read = pendingWithPrefix<{ at: string }>("ann-read|");
  const acked = pendingWithPrefix<{ at: string }>("ann-ack|");
  return storedAnnouncements().map((a) => {
    const localRead = read.get(announcementReadKey(a.id));
    const localAck = acked.get(announcementAckKey(a.id));
    return {
      ...a,
      readAt: a.readAt ?? localRead?.at ?? localAck?.at ?? null,
      canAcknowledge: a.canAcknowledge && !localAck,
      ackWaiting: !!localAck && !a.schoolAcknowledged,
    };
  });
}

/** Unread, plus still to acknowledge (each counted once). */
export const announcementsWaiting = () =>
  announcements().filter((a) => (!a.readAt && !a.withdrawnAt) || a.canAcknowledge).length;
