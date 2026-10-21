import prisma from "@/lib/db/prisma";
import type { ExamType, Prisma } from "@prisma/client";

/**
 * The phone's operations by id (Phase 5), so a resend after a dropped connection gets the first
 * answer instead of being applied twice. School-owned (row-level security).
 */
export class SyncOperationRepository {
  /** Claim the operation id. Null if it was already received (then read it with `find`). */
  async claim(data: { userId: string; opId: string; type: string; deviceId: string | null }) {
    try {
      return await prisma.syncOperation.create({ data: { ...data, status: "PROCESSING" }, select: { id: true } });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") return null;
      throw error;
    }
  }

  find(userId: string, opId: string) {
    return prisma.syncOperation.findFirst({
      where: { userId, opId },
      select: { id: true, status: true, response: true },
    });
  }

  finish(id: string, status: "APPLIED" | "REJECTED", response: Prisma.InputJsonValue) {
    return prisma.syncOperation.update({ where: { id }, data: { status, response, finishedAt: new Date() } });
  }

  /** Server's current attendance rows for these learners in this register (for conflict checks). */
  findAttendance(classId: string, date: Date, timetableSlotId: string | null, studentIds: string[]) {
    return prisma.attendanceRecord.findMany({
      where: { classId, date, timetableSlotId, studentId: { in: studentIds } },
      select: { studentId: true, version: true, status: true, updatedAt: true },
    });
  }

  findAssessmentForEntry(assessmentId: string) {
    return prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, status: true, termId: true, examType: true },
    });
  }

  findWindow(termId: string, examType: ExamType) {
    return prisma.assessmentWindow.findUnique({
      where: { termId_examType: { termId, examType } },
      select: { closesAt: true },
    });
  }

  findTeacherProfileId(userId: string) {
    return prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true, firstName: true, lastName: true } });
  }
}

export const syncOperationRepository = new SyncOperationRepository();
