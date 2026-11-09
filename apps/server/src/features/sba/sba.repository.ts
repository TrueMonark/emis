import type { Prisma, SbaEventAction, SbaSheetStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";

const sheetInclude = {
  academicYear: { select: { id: true, year: true, isActive: true } },
  class: { select: { id: true, name: true, grade: { select: { id: true, name: true, stage: true, curriculum: true } } } },
  subject: {
    select: {
      id: true,
      name: true,
      code: true,
      departmentId: true,
      catalogueSubjectId: true,
      catalogueSubject: { select: { code: true } },
      department: { select: { id: true, name: true, hodTeacherId: true } },
    },
  },
  teacher: { select: { id: true, userId: true, firstName: true, lastName: true, staffNumber: true } },
  tasks: { orderBy: { number: "asc" } },
} satisfies Prisma.SbaSheetInclude;

export type SbaSheetRow = Prisma.SbaSheetGetPayload<{ include: typeof sheetInclude }>;

/** SBA score sheets (school-owned). Thin data access; rules are in sba.service.ts. */
export class SbaRepository {
  findTeacherByUserId(userId: string) {
    return prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true, firstName: true, lastName: true } });
  }

  findActiveYear() {
    return prisma.academicYear.findFirst({ where: { isActive: true }, select: { id: true, year: true } });
  }

  findYear(year: number) {
    return prisma.academicYear.findFirst({ where: { year }, select: { id: true, year: true } });
  }

  findHodDepartmentId(userId: string) {
    return prisma.department.findFirst({ where: { hodTeacher: { userId } }, select: { id: true } });
  }

  /** What a teacher teaches this year in classes that keep SBA (2023-curriculum O-level). */
  findTeachingAssignments(where: Prisma.SubjectTeacherAssignmentWhereInput) {
    return prisma.subjectTeacherAssignment.findMany({
      where: { ...where, endedAt: null, class: { grade: { stage: "O_LEVEL", curriculum: "CBC_2023" } } },
      select: {
        teacherId: true,
        classId: true,
        subjectId: true,
        class: { select: { name: true, grade: { select: { name: true, sequence: true } } } },
        subject: { select: { name: true, departmentId: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  findSheets(where: Prisma.SbaSheetWhereInput) {
    return prisma.sbaSheet.findMany({ where, include: sheetInclude, orderBy: [{ updatedAt: "desc" }] });
  }

  findSheet(id: string) {
    return prisma.sbaSheet.findUnique({ where: { id }, include: sheetInclude });
  }

  findSheetFor(academicYearId: string, classId: string, subjectId: string, teacherId: string) {
    return prisma.sbaSheet.findUnique({
      where: { academicYearId_classId_subjectId_teacherId: { academicYearId, classId, subjectId, teacherId } },
    });
  }

  findEvents(sheetId: string) {
    return prisma.sbaSheetEvent.findMany({ where: { sheetId }, orderBy: [{ at: "asc" }, { id: "asc" }] });
  }

  /** The class's learners this school year. */
  findRoster(classId: string, academicYearId: string) {
    return prisma.studentClassEnrollment.findMany({
      where: { classId, academicYearId, status: "ACTIVE", student: { deletedAt: null } },
      select: { student: { select: { id: true, firstName: true, middleName: true, lastName: true, learnerNumber: true, gender: true } } },
    });
  }

  findStudents(ids: string[]) {
    return prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, middleName: true, lastName: true, learnerNumber: true, gender: true },
    });
  }

  findMarks(sheetId: string) {
    return prisma.sbaMark.findMany({ where: { task: { sheetId } }, select: { studentId: true, marks: true, isAbsent: true, task: { select: { number: true } } } });
  }

  findNotes(sheetId: string) {
    return prisma.sbaLearnerNote.findMany({ where: { sheetId } });
  }

  /** The highest mark given for each task (to refuse lowering a maximum below it). */
  async highestMarks(sheetId: string) {
    const rows = await prisma.sbaMark.groupBy({ by: ["taskId"], where: { task: { sheetId } }, _max: { marks: true } });
    return new Map(rows.map((r) => [r.taskId, r._max.marks ?? 0]));
  }

  /** A new sheet with its six tasks and its first history line, together. */
  createSheet(
    data: { academicYearId: string; classId: string; subjectId: string; teacherId: string },
    tasks: { number: number; title: string; maxMarks: number }[],
    byUserId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const sheet = await tx.sbaSheet.create({ data: { ...data, tasks: { create: tasks } } });
      await tx.sbaSheetEvent.create({ data: { sheetId: sheet.id, action: "STARTED", byUserId } });
      return sheet;
    });
  }

  /** Change tasks (all or none), only while the sheet is still in one of `open`. */
  updateTasks(
    sheetId: string,
    open: SbaSheetStatus[],
    tasks: { id: string; title: string; description: string | null; maxMarks: number; dueDate: Date | null }[]
  ) {
    return prisma.$transaction(async (tx) => {
      const sheet = await tx.sbaSheet.findFirst({ where: { id: sheetId, status: { in: open } }, select: { id: true } });
      if (!sheet) return false;
      for (const t of tasks) {
        await tx.sbaTask.update({
          where: { id: t.id },
          data: { title: t.title, description: t.description, maxMarks: t.maxMarks, dueDate: t.dueDate },
        });
      }
      await tx.sbaSheet.update({ where: { id: sheetId }, data: { updatedAt: new Date() } });
      return true;
    });
  }

  /** Save marks and learner notes (all or none), only while the sheet is still open. */
  saveEntries(
    sheetId: string,
    open: SbaSheetStatus[],
    marks: { taskId: string; studentId: string; marks: number | null; isAbsent: boolean }[],
    notes: { studentId: string; examinationNumber: string | null; comment: string | null }[]
  ) {
    return prisma.$transaction(async (tx) => {
      // Lock the sheet row so a submit can't slip in between the check and the writes.
      const locked = await tx.$queryRaw<{ status: string }[]>`SELECT "status"::text AS status FROM "sba_sheets" WHERE "id" = ${sheetId} FOR UPDATE`;
      if (!locked[0] || !(open as string[]).includes(locked[0].status)) return false;
      for (const m of marks) {
        await tx.sbaMark.upsert({
          where: { taskId_studentId: { taskId: m.taskId, studentId: m.studentId } },
          create: m,
          update: { marks: m.marks, isAbsent: m.isAbsent },
        });
      }
      for (const n of notes) {
        await tx.sbaLearnerNote.upsert({
          where: { sheetId_studentId: { sheetId, studentId: n.studentId } },
          create: { sheetId, ...n },
          update: { examinationNumber: n.examinationNumber, comment: n.comment },
        });
      }
      await tx.sbaSheet.update({ where: { id: sheetId }, data: { updatedAt: new Date() } });
      return true;
    });
  }

  /**
   * Change a sheet's status only if it is still in one of `from` (two people pressing at once
   * can't both win), with its history line, in one transaction.
   */
  transition(
    id: string,
    from: SbaSheetStatus[],
    data: Prisma.SbaSheetUpdateManyMutationInput,
    event: { action: SbaEventAction; byUserId: string; comment?: string | null }
  ) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.sbaSheet.updateMany({ where: { id, status: { in: from } }, data });
      if (count === 0) return false;
      await tx.sbaSheetEvent.create({ data: { sheetId: id, ...event } });
      return true;
    });
  }

  /**
   * Last year's sheets in the same subject for these learners (for the "Form 2 + Form 3" score
   * sheet): same school subject, or the same national catalogue subject.
   */
  findEarlierSheets(academicYearId: string, subject: { id: string; catalogueSubjectId: string | null }, studentIds: string[]) {
    return prisma.sbaSheet.findMany({
      where: {
        academicYearId,
        OR: [{ subjectId: subject.id }, ...(subject.catalogueSubjectId ? [{ subject: { catalogueSubjectId: subject.catalogueSubjectId } }] : [])],
        tasks: { some: { marks: { some: { studentId: { in: studentIds } } } } },
      },
      include: {
        class: { select: { name: true, grade: { select: { name: true } } } },
        tasks: { orderBy: { number: "asc" }, include: { marks: { where: { studentId: { in: studentIds } } } } },
        notes: { where: { studentId: { in: studentIds } }, select: { studentId: true, examinationNumber: true } },
      },
    });
  }

  findSchoolForPrint(schoolId: string) {
    return prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, eczCentreCode: true, districtOffice: { select: { name: true, parent: { select: { name: true } } } } },
    });
  }

  findHeadTeacher(schoolId: string) {
    return prisma.schoolMembership.findFirst({
      where: { schoolId, status: "ACTIVE", role: { in: ["HEAD_TEACHER", "ADMIN"] } },
      select: { user: { select: { displayName: true, email: true, profile: { select: { firstName: true, lastName: true, staffNumber: true } } } } },
    });
  }

  setCentreCode(schoolId: string, eczCentreCode: string | null) {
    return prisma.school.update({ where: { id: schoolId }, data: { eczCentreCode }, select: { eczCentreCode: true } });
  }

  findUserNames(ids: string[]) {
    return prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, email: true } });
  }

  /** The head teacher and deputy of a school (memberships are national: always say which school). */
  findSchoolLeaderIds(schoolId: string) {
    return prisma.schoolMembership
      .findMany({ where: { schoolId, status: "ACTIVE", role: { in: ["HEAD_TEACHER", "DEPUTY_HEAD", "ADMIN"] } }, select: { userId: true } })
      .then((r) => r.map((m) => m.userId));
  }

  findUserIdOfTeacher(teacherId: string) {
    return prisma.teacherProfile.findUnique({ where: { id: teacherId }, select: { userId: true } }).then((t) => t?.userId ?? null);
  }

  notify(senderId: string, recipientIds: string[], subject: string, message: string, sheetId: string) {
    const to = [...new Set(recipientIds)].filter((id) => id !== senderId);
    if (to.length === 0) return Promise.resolve({ count: 0 });
    return prisma.notification.createMany({
      data: to.map((recipientId) => ({
        senderId,
        recipientId,
        subject,
        message,
        type: "APPROVAL_REQUEST" as const,
        relatedEntityType: "SBA_SHEET",
        relatedEntityId: sheetId,
      })),
    });
  }

  /** Counts per school for the offices (emis_sba_progress; counts only). */
  progress(schoolIds: string[]) {
    if (schoolIds.length === 0) return Promise.resolve([]);
    return prisma.$queryRaw<
      { school_id: string; expected: number; draft: number; submitted: number; returned: number; hod_approved: number; confirmed: number }[]
    >`SELECT * FROM emis_sba_progress(${schoolIds}::text[])`;
  }
}

export const sbaRepository = new SbaRepository();
