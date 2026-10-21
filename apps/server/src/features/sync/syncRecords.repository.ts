import prisma from "@/lib/db/prisma";
import type { SyncEntity } from "./teacherScope.service";

/**
 * What a phone receives for each synced table (Phase 5): only the fields the teacher app needs,
 * so a phone never holds more than necessary (Data Protection Act; design §7 rule 7). Learners
 * come with their name, gender and learner number only: no birth dates, addresses, medical or
 * vulnerability details, and no guardians.
 *
 * Every record carries `id` and `version` (the phone sends the version back when it changes it).
 */
const FIELDS = {
  academic_years: { id: true, version: true, year: true, startDate: true, endDate: true, isActive: true, isClosed: true },
  terms: { id: true, version: true, academicYearId: true, termType: true, startDate: true, endDate: true, isActive: true },
  grades: { id: true, version: true, name: true, shortName: true, stage: true, schoolLevel: true, sequence: true, exam: true },
  classes: { id: true, version: true, name: true, gradeId: true, status: true },
  subjects: { id: true, version: true, code: true, name: true, departmentId: true },
  class_subjects: { id: true, version: true, classId: true, subjectId: true, periodsPerWeek: true, isCore: true },
  students: { id: true, version: true, learnerNumber: true, firstName: true, middleName: true, lastName: true, gender: true, status: true },
  student_class_enrollments: { id: true, version: true, studentId: true, classId: true, academicYearId: true, status: true },
  class_teacher_assignments: { id: true, version: true, teacherId: true, classId: true, academicYearId: true, endedAt: true },
  subject_teacher_assignments: { id: true, version: true, teacherId: true, subjectId: true, classId: true, academicYearId: true, endedAt: true },
  timetable_slots: { id: true, version: true, classId: true, subjectId: true, teacherId: true, academicYearId: true, dayOfWeek: true, periodNumber: true, startTime: true, endTime: true, roomNumber: true },
  assessments: { id: true, version: true, title: true, subjectId: true, classId: true, termId: true, examType: true, totalMarks: true, passMark: true, assessmentDate: true, status: true },
  student_assessment_results: { id: true, version: true, studentId: true, assessmentId: true, marksObtained: true, isAbsent: true, grade: true, remarks: true, updatedAt: true },
  attendance_records: { id: true, version: true, studentId: true, classId: true, termId: true, timetableSlotId: true, date: true, status: true, remarks: true, markedById: true, updatedAt: true },
  lesson_logs: { id: true, version: true, timetableSlotId: true, date: true, topic: true, subtopics: true, updatedAt: true },
  register_covers: { id: true, version: true, classId: true, teacherId: true, startDate: true, endDate: true, cancelledAt: true },
  special_classes: { id: true, version: true, classId: true, subjectId: true, termId: true, teacherId: true, date: true, startTime: true, endTime: true, topic: true, venue: true, status: true, decisionNote: true },
  special_class_attendance: { id: true, version: true, specialClassId: true, studentId: true, status: true, remarks: true, updatedAt: true },
} as const satisfies Record<SyncEntity, Record<string, true>>;

export type SyncRecord = { id: string; version: number } & Record<string, unknown>;

type FindMany = (args: { where: { id: { in: string[] } }; select: Record<string, true> }) => Promise<SyncRecord[]>;

/** The Prisma model behind each synced table. */
function model(entity: SyncEntity): FindMany {
  const delegates: Record<SyncEntity, unknown> = {
    academic_years: prisma.academicYear,
    terms: prisma.term,
    grades: prisma.grade,
    classes: prisma.class,
    subjects: prisma.subject,
    class_subjects: prisma.classSubject,
    students: prisma.student,
    student_class_enrollments: prisma.studentClassEnrollment,
    class_teacher_assignments: prisma.classTeacherAssignment,
    subject_teacher_assignments: prisma.subjectTeacherAssignment,
    timetable_slots: prisma.timetableSlot,
    assessments: prisma.assessment,
    student_assessment_results: prisma.studentAssessmentResult,
    attendance_records: prisma.attendanceRecord,
    lesson_logs: prisma.lessonLog,
    register_covers: prisma.registerCover,
    special_classes: prisma.specialClass,
    special_class_attendance: prisma.specialClassAttendance,
  };
  const delegate = delegates[entity] as { findMany: FindMany };
  return (args) => delegate.findMany(args);
}

const CHUNK = 5000;

export class SyncRecordsRepository {
  /** The phone's fields of these rows (rows deleted in the meantime are simply missing). */
  async findByIds(entity: SyncEntity, ids: string[]): Promise<SyncRecord[]> {
    if (ids.length === 0) return [];
    const out: SyncRecord[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      out.push(...(await model(entity)({ where: { id: { in: ids.slice(i, i + CHUNK) } }, select: FIELDS[entity] })));
    }
    return out;
  }
}

export const syncRecordsRepository = new SyncRecordsRepository();
