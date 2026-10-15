import prisma from "@/lib/db/prisma";

const teacherSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffNumber: true,
} as const;

/**
 * Register covers: a class teacher (or a school leader) hands the daily class register to
 * another teacher for a few days — e.g. when the class teacher is away from school.
 * Thin data layer; the rules live in registerCover.service.ts.
 */
export class RegisterCoverRepository {
  create(data: {
    classId: string;
    teacherId: string;
    startDate: Date;
    endDate: Date;
    reason?: string | null;
    createdById: string;
  }) {
    return prisma.registerCover.create({
      data,
      include: { teacher: { select: teacherSelect } },
    });
  }

  findById(id: string) {
    return prisma.registerCover.findUnique({ where: { id } });
  }

  cancel(id: string) {
    return prisma.registerCover.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });
  }

  /** Covers for a class that haven't been cancelled and haven't finished before `from`. */
  findCurrentAndUpcomingForClass(classId: string, from: Date) {
    return prisma.registerCover.findMany({
      where: { classId, cancelledAt: null, endDate: { gte: from } },
      include: { teacher: { select: teacherSelect } },
      orderBy: { startDate: "asc" },
    });
  }

  /** A cover for this teacher and class that includes `date`. */
  findActiveForTeacherAndClass(teacherId: string, classId: string, date: Date) {
    return prisma.registerCover.findFirst({
      where: {
        teacherId,
        classId,
        cancelledAt: null,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  }

  /** Covers this teacher is doing (or will do) from `from` onwards, with class details. */
  findCurrentAndUpcomingForTeacher(teacherId: string, from: Date) {
    return prisma.registerCover.findMany({
      where: { teacherId, cancelledAt: null, endDate: { gte: from } },
      include: {
        class: { include: { grade: true } },
      },
      orderBy: { startDate: "asc" },
    });
  }

  /** Overlapping, not-cancelled covers for a class (only one cover at a time per class). */
  findOverlappingForClass(classId: string, startDate: Date, endDate: Date) {
    return prisma.registerCover.findFirst({
      where: {
        classId,
        cancelledAt: null,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { teacher: { select: teacherSelect } },
    });
  }
}

export const registerCoverRepository = new RegisterCoverRepository();
