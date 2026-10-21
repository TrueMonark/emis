import prisma from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import { getTodayUtcMidnight } from "@/lib/utils/date-utils";
import { createHash } from "node:crypto";

function fingerprintOf(anchors: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(anchors)).digest("base64url").slice(0, 22);
}

/**
 * Exactly which records a teacher's phone may hold (design §7 rule 7): their classes, those
 * classes' learners and enrolments, their timetable, the assessments and marks they deal with,
 * and this term's attendance for their classes. Nothing about other classes or other teachers.
 * Keeps the download small and is the minimum the teacher needs (Data Protection Act).
 *
 * Ids only. What fields of each record a phone gets is decided by the sync API (Phase 5).
 */
export interface TeacherScope {
  teacherProfileId: string;
  academicYearId: string | null;
  /** Table name → ids of rows in scope */
  ids: Record<SyncEntity, Set<string>>;
  /**
   * What decides the scope: the year, active term, the teacher's classes and subjects, register
   * covers and weekend classes. When it changes (a new class, a cover, a new term), rows the phone
   * never held can come into scope without being changed themselves, so the phone must download
   * its scope again (Phase 5: the sync API compares this fingerprint).
   */
  fingerprint: string;
}

export const SYNC_ENTITIES = [
  "academic_years",
  "terms",
  "grades",
  "classes",
  "subjects",
  "class_subjects",
  "students",
  "student_class_enrollments",
  "class_teacher_assignments",
  "subject_teacher_assignments",
  "timetable_slots",
  "assessments",
  "student_assessment_results",
  "attendance_records",
  "lesson_logs",
  "register_covers",
  "special_classes",
  "special_class_attendance",
] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

const ids = <T extends { id: string }>(rows: T[]) => new Set(rows.map((r) => r.id));

export class TeacherScopeService {
  async forUser(userId: string): Promise<TeacherScope> {
    const teacher = await prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!teacher) throw new NotFoundError("Teacher profile not found");
    return this.forTeacher(teacher.id);
  }

  async forTeacher(teacherProfileId: string): Promise<TeacherScope> {
    const empty = Object.fromEntries(SYNC_ENTITIES.map((e) => [e, new Set<string>()])) as Record<
      SyncEntity,
      Set<string>
    >;
    const year = await prisma.academicYear.findFirst({ where: { isActive: true }, select: { id: true } });
    if (!year) return { teacherProfileId, academicYearId: null, ids: empty, fingerprint: fingerprintOf({ year: null }) };

    const today = getTodayUtcMidnight();
    const [classTeacher, subjectTeacher, slots, covers, terms] = await Promise.all([
      prisma.classTeacherAssignment.findMany({
        where: { teacherId: teacherProfileId, academicYearId: year.id, endedAt: null },
        select: { id: true, classId: true },
      }),
      prisma.subjectTeacherAssignment.findMany({
        // Ended assignments (e.g. after a transfer) no longer give access to the class.
        where: { teacherId: teacherProfileId, academicYearId: year.id, endedAt: null },
        select: { id: true, classId: true, subjectId: true },
      }),
      prisma.timetableSlot.findMany({
        where: { teacherId: teacherProfileId, academicYearId: year.id },
        select: { id: true, classId: true, subjectId: true },
      }),
      prisma.registerCover.findMany({
        where: { teacherId: teacherProfileId, cancelledAt: null, endDate: { gte: today } },
        select: { id: true, classId: true },
      }),
      prisma.term.findMany({ where: { academicYearId: year.id }, select: { id: true, isActive: true } }),
    ]);

    const ownClassIds = new Set(classTeacher.map((a) => a.classId));
    const classIds = new Set<string>([
      ...ownClassIds,
      ...subjectTeacher.map((a) => a.classId),
      ...slots.map((s) => s.classId),
      ...covers.map((c) => c.classId),
    ]);
    // Subjects a teacher teaches, per class ("classId:subjectId").
    const taught = new Set<string>([
      ...subjectTeacher.map((a) => `${a.classId}:${a.subjectId}`),
      ...slots.map((s) => `${s.classId}:${s.subjectId}`),
    ]);
    const classList = [...classIds];
    const activeTermIds = terms.filter((t) => t.isActive).map((t) => t.id);

    const [classes, classSubjects, enrollments, assessments, attendance, lessonLogs, specialClasses] = await Promise.all([
      prisma.class.findMany({ where: { id: { in: classList } }, select: { id: true, gradeId: true } }),
      prisma.classSubject.findMany({
        where: { classId: { in: classList } },
        select: { id: true, subjectId: true },
      }),
      prisma.studentClassEnrollment.findMany({
        where: { classId: { in: classList }, academicYearId: year.id, status: "ACTIVE" },
        select: { id: true, studentId: true },
      }),
      prisma.assessment.findMany({
        where: { classId: { in: classList }, termId: { in: terms.map((t) => t.id) } },
        select: { id: true, classId: true, subjectId: true },
      }),
      // This term's attendance for their classes (the registers a phone shows and corrects).
      prisma.attendanceRecord.findMany({
        where: { classId: { in: classList }, termId: { in: activeTermIds } },
        select: { id: true },
      }),
      prisma.lessonLog.findMany({
        where: { timetableSlotId: { in: slots.map((s) => s.id) } },
        select: { id: true },
      }),
      // Their own weekend classes this year (Phase 5), any status, so the phone shows decisions.
      prisma.specialClass.findMany({
        where: { teacherId: teacherProfileId, term: { academicYearId: year.id } },
        select: { id: true },
      }),
    ]);

    // A class teacher sees all of their own class's assessments; a subject teacher only theirs.
    const myAssessments = assessments.filter(
      (a) => ownClassIds.has(a.classId) || taught.has(`${a.classId}:${a.subjectId}`)
    );
    const results = await prisma.studentAssessmentResult.findMany({
      where: { assessmentId: { in: myAssessments.map((a) => a.id) } },
      select: { id: true },
    });

    const specialAttendance = await prisma.specialClassAttendance.findMany({
      where: { specialClassId: { in: specialClasses.map((c) => c.id) } },
      select: { id: true },
    });

    const fingerprint = fingerprintOf({
      year: year.id,
      activeTerms: activeTermIds.sort(),
      classes: [...classIds].sort(),
      ownClasses: [...ownClassIds].sort(),
      taught: [...taught].sort(),
      covers: covers.map((c) => c.id).sort(),
    });
    const scope: TeacherScope = { teacherProfileId, academicYearId: year.id, ids: empty, fingerprint };
    scope.ids.academic_years = new Set([year.id]);
    scope.ids.terms = ids(terms);
    scope.ids.classes = classIds;
    scope.ids.grades = new Set(classes.map((c) => c.gradeId));
    scope.ids.class_subjects = ids(classSubjects);
    scope.ids.subjects = new Set([
      ...classSubjects.map((cs) => cs.subjectId),
      ...subjectTeacher.map((a) => a.subjectId),
      ...slots.map((s) => s.subjectId),
    ]);
    scope.ids.students = new Set(enrollments.map((e) => e.studentId));
    scope.ids.student_class_enrollments = ids(enrollments);
    scope.ids.class_teacher_assignments = ids(classTeacher);
    scope.ids.subject_teacher_assignments = ids(subjectTeacher);
    scope.ids.timetable_slots = ids(slots);
    scope.ids.assessments = ids(myAssessments);
    scope.ids.student_assessment_results = ids(results);
    scope.ids.attendance_records = ids(attendance);
    scope.ids.lesson_logs = ids(lessonLogs);
    scope.ids.register_covers = ids(covers);
    scope.ids.special_classes = ids(specialClasses);
    scope.ids.special_class_attendance = ids(specialAttendance);
    return scope;
  }
}

export const teacherScopeService = new TeacherScopeService();
