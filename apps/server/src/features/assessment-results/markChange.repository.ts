import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Marks history (Phase 5b). Lines are written by a database trigger on
 * student_assessment_results for every entry, change and deletion; the only lines written from
 * code are phone changes that weren't applied because a newer mark was already there.
 */
export class MarkChangeRepository {
  findForAssessment(assessmentId: string, studentId?: string | null) {
    return prisma.markChange.findMany({
      where: { assessmentId, ...(studentId ? { studentId } : {}) },
      include: { student: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
      orderBy: { changedAt: "desc" },
      take: 2000,
    });
  }

  recordNotApplied(rows: Prisma.MarkChangeUncheckedCreateInput[]) {
    return prisma.markChange.createMany({ data: rows });
  }

  /** Names of the people who made changes (users are national: only these ids). */
  findUserNames(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, email: true, profile: { select: { firstName: true, lastName: true } } },
    });
  }

  /** The current marks of some learners (for the phone conflict check). */
  findCurrent(assessmentId: string, studentIds: string[]) {
    return prisma.studentAssessmentResult.findMany({
      where: { assessmentId, studentId: { in: studentIds } },
      select: { id: true, studentId: true, version: true, updatedAt: true, marksObtained: true, isAbsent: true, remarks: true },
    });
  }
}

export const markChangeRepository = new MarkChangeRepository();
