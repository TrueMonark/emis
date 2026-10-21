import prisma from "@/lib/db/prisma";
import type { AttendanceStatus, Prisma, SpecialClassStatus } from "@prisma/client";
import { SCHOOL_LEADER_ROLES } from "@school/shared/auth/role-hierarchy";
import { requireSchoolId } from "@/lib/db/tenant";

const listInclude = {
  class: { select: { id: true, name: true, grade: { select: { name: true } } } },
  subject: { select: { id: true, name: true, code: true, departmentId: true } },
  teacher: { select: { id: true, userId: true, firstName: true, lastName: true } },
  _count: { select: { attendance: true } },
} satisfies Prisma.SpecialClassInclude;

export type SpecialClassRow = Prisma.SpecialClassGetPayload<{ include: typeof listInclude }>;

/** Special (weekend) classes and their registers. Thin data access only. */
export class SpecialClassRepository {
  findTeacherByUserId(userId: string) {
    return prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true, firstName: true, lastName: true } });
  }

  /** The term (of the active academic year) that contains the date. */
  findTermForDate(date: Date) {
    return prisma.term.findFirst({
      where: { startDate: { lte: date }, endDate: { gte: date }, academicYear: { isActive: true } },
      select: { id: true, academicYearId: true, academicYear: { select: { isClosed: true } } },
    });
  }

  /** Whether the teacher teaches the subject in the class this year (active assignment or timetable). */
  async teaches(teacherId: string, classId: string, subjectId: string, academicYearId: string) {
    const [assignment, slot] = await Promise.all([
      prisma.subjectTeacherAssignment.count({ where: { teacherId, classId, subjectId, academicYearId, endedAt: null } }),
      prisma.timetableSlot.count({ where: { teacherId, classId, subjectId, academicYearId } }),
    ]);
    return assignment + slot > 0;
  }

  findSubjectWithHod(subjectId: string) {
    return prisma.subject.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        name: true,
        departmentId: true,
        department: { select: { id: true, name: true, hodTeacher: { select: { id: true, userId: true } } } },
      },
    });
  }

  findClass(classId: string) {
    return prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true, grade: { select: { name: true } } } });
  }

  /** Classes for the class that day which are still on (not turned down or cancelled). */
  findLiveOnDay(classId: string, date: Date) {
    return prisma.specialClass.findMany({
      where: { classId, date, status: { in: ["PENDING", "APPROVED"] } },
      select: { id: true, startTime: true, endTime: true, subject: { select: { name: true } } },
    });
  }

  create(data: Prisma.SpecialClassUncheckedCreateInput) {
    return prisma.specialClass.create({ data, include: listInclude });
  }

  findById(id: string) {
    return prisma.specialClass.findUnique({
      where: { id },
      include: { ...listInclude, term: { select: { academicYearId: true, academicYear: { select: { isClosed: true } } } } },
    });
  }

  findMany(where: Prisma.SpecialClassWhereInput) {
    return prisma.specialClass.findMany({ where, include: listInclude, orderBy: [{ date: "desc" }, { startTime: "asc" }] });
  }

  decide(id: string, status: SpecialClassStatus, decidedById: string, note: string | null) {
    return prisma.specialClass.update({
      where: { id },
      data: { status, decidedById, decidedAt: new Date(), decisionNote: note },
      include: listInclude,
    });
  }

  /** The department the user is HOD of (HOD is a position: Department.hodTeacherId). */
  findHodDepartmentId(userId: string) {
    return prisma.department.findFirst({ where: { hodTeacher: { userId } }, select: { id: true } });
  }

  isClassTeacher(teacherId: string, classId: string, academicYearId: string) {
    return prisma.classTeacherAssignment.count({ where: { teacherId, classId, academicYearId, endedAt: null } });
  }

  /** Learners on the class list this year (for the register). */
  findRoster(classId: string, academicYearId: string) {
    return prisma.studentClassEnrollment.findMany({
      where: { classId, academicYearId, status: "ACTIVE" },
      select: { student: { select: { id: true, firstName: true, middleName: true, lastName: true, gender: true, learnerNumber: true } } },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    });
  }

  findMarks(specialClassId: string) {
    return prisma.specialClassAttendance.findMany({
      where: { specialClassId },
      select: { id: true, studentId: true, status: true, remarks: true, version: true, updatedAt: true },
    });
  }

  /** Save the register: one row per learner, created or updated, all together. */
  saveMarks(
    specialClassId: string,
    markedById: string | null,
    records: { studentId: string; status: AttendanceStatus; remarks?: string | null }[]
  ) {
    return prisma.$transaction(
      records.map((r) =>
        prisma.specialClassAttendance.upsert({
          where: { specialClassId_studentId: { specialClassId, studentId: r.studentId } },
          update: { status: r.status, remarks: r.remarks ?? null, markedById },
          create: { specialClassId, studentId: r.studentId, status: r.status, remarks: r.remarks ?? null, markedById },
        })
      )
    );
  }

  findActiveYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true }, select: { id: true } });
  }

  /** Class + subject pairs the teacher teaches this year (assignments and timetable). */
  async findTeachingPairs(teacherId: string, academicYearId: string) {
    const select = {
      class: { select: { id: true, name: true, grade: { select: { name: true, sequence: true } } } },
      subject: { select: { id: true, name: true } },
    } as const;
    const [assignments, slots] = await Promise.all([
      prisma.subjectTeacherAssignment.findMany({ where: { teacherId, academicYearId, endedAt: null }, select }),
      prisma.timetableSlot.findMany({ where: { teacherId, academicYearId }, select, distinct: ["classId", "subjectId"] }),
    ]);
    return [...assignments, ...slots];
  }

  /** Every class subject (for the head/deputy). */
  findAllClassSubjects() {
    return prisma.classSubject.findMany({
      where: { class: { status: "ACTIVE" } },
      select: {
        class: { select: { id: true, name: true, grade: { select: { name: true, sequence: true } } } },
        subject: { select: { id: true, name: true } },
      },
    });
  }

  findSchoolLeaders(exceptUserId: string) {
    return prisma.schoolMembership.findMany({
      where: { schoolId: requireSchoolId(), status: "ACTIVE", role: { in: [...SCHOOL_LEADER_ROLES] }, userId: { not: exceptUserId } },
      select: { userId: true },
    });
  }

  notify(senderId: string, recipientIds: string[], subject: string, message: string, specialClassId: string) {
    if (recipientIds.length === 0) return Promise.resolve({ count: 0 });
    return prisma.notification.createMany({
      data: [...new Set(recipientIds)].map((recipientId) => ({
        senderId,
        recipientId,
        subject,
        message,
        type: "APPROVAL_REQUEST" as const,
        relatedEntityType: "SPECIAL_CLASS",
        relatedEntityId: specialClassId,
      })),
    });
  }
}

export const specialClassRepository = new SpecialClassRepository();
