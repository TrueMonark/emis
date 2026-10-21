import { currentStaffWhere } from "@/features/schools/schoolMembership.repository";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { Role } from "@school/shared/types/prisma-enums";
import prisma from "@/lib/db/prisma";
import { NotFoundError, UnauthorizedError, ValidationError, ConflictError } from "@/lib/errors";
import { normalizeToUtcMidnight, getTodayUtcMidnight } from "@/lib/utils/date-utils";
import { registerCoverRepository } from "./registerCover.repository";

export interface CoverContext {
  userId: string;
  role: Role | string;
}

export interface CreateRegisterCoverInput {
  classId: string;
  teacherId: string;
  startDate: Date | string;
  endDate: Date | string;
  reason?: string | null;
}

/** Longest single hand-over; a longer absence needs a new class teacher, not a cover. */
export const MAX_COVER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The daily class register belongs to the class teacher. When they can't be at school, they
 * (or the head/deputy) can hand it to another teacher for a set number of days — a
 * "register cover". This service holds the rules for covers and the single question the
 * attendance service asks: "may this person take this class's morning register on this day?"
 */
export class RegisterCoverService {
  private async teacherProfileIdFor(userId: string): Promise<string | null> {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  private async activeYearId(): Promise<string | null> {
    const year = await prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    return year?.id ?? null;
  }

  /** The class's current class teacher (this academic year, assignment not ended). */
  async currentClassTeacherId(classId: string, academicYearId?: string | null): Promise<string | null> {
    const yearId = academicYearId ?? (await this.activeYearId());
    if (!yearId) return null;
    const assignment = await prisma.classTeacherAssignment.findFirst({
      where: { classId, academicYearId: yearId, endedAt: null },
      select: { teacherId: true },
    });
    return assignment?.teacherId ?? null;
  }

  /** Head/deputy for any class; otherwise only the class's own class teacher. */
  private async assertCanManage(classId: string, context: CoverContext) {
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!cls) throw new NotFoundError("Class not found");
    if (isSchoolLeader(context.role)) return;

    const me = await this.teacherProfileIdFor(context.userId);
    const classTeacher = await this.currentClassTeacherId(classId);
    if (!me || !classTeacher || me !== classTeacher) {
      throw new UnauthorizedError("Only the class teacher or the head/deputy can hand over this register");
    }
  }

  async listForClass(classId: string, context: CoverContext) {
    await this.assertCanManage(classId, context);
    return registerCoverRepository.findCurrentAndUpcomingForClass(classId, getTodayUtcMidnight());
  }

  async create(input: CreateRegisterCoverInput, context: CoverContext) {
    await this.assertCanManage(input.classId, context);

    const startDate = normalizeToUtcMidnight(input.startDate);
    const endDate = normalizeToUtcMidnight(input.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError("Choose a valid first and last day");
    }
    if (endDate < startDate) {
      throw new ValidationError("The last day can't be before the first day");
    }
    if (endDate < getTodayUtcMidnight()) {
      throw new ValidationError("The cover can't end in the past");
    }
    const days = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
    if (days > MAX_COVER_DAYS) {
      throw new ValidationError(
        `A cover can last at most ${MAX_COVER_DAYS} days — for longer, assign a new class teacher`
      );
    }

    // Row-level security means only teachers at this school are found here.
    const coveringTeacher = await prisma.teacherProfile.findUnique({
      where: { id: input.teacherId },
      select: { id: true, status: true },
    });
    if (!coveringTeacher) throw new NotFoundError("Teacher not found");
    if (coveringTeacher.status !== "ACTIVE") {
      throw new ValidationError("That teacher isn't active at the moment");
    }

    const classTeacher = await this.currentClassTeacherId(input.classId);
    if (classTeacher && classTeacher === input.teacherId) {
      throw new ValidationError("That teacher is already the class teacher of this class");
    }

    const overlap = await registerCoverRepository.findOverlappingForClass(
      input.classId,
      startDate,
      endDate
    );
    if (overlap) {
      throw new ConflictError(
        `${overlap.teacher.firstName} ${overlap.teacher.lastName} is already covering this register for some of those days — cancel that cover first`
      );
    }

    return registerCoverRepository.create({
      classId: input.classId,
      teacherId: input.teacherId,
      startDate,
      endDate,
      reason: input.reason?.trim() || null,
      createdById: context.userId,
    });
  }

  async cancel(id: string, context: CoverContext) {
    const cover = await registerCoverRepository.findById(id);
    if (!cover || cover.cancelledAt) throw new NotFoundError("Cover not found");
    await this.assertCanManage(cover.classId, context);
    return registerCoverRepository.cancel(id);
  }

  /** Teachers who could take the register (active staff at this school), for the picker. */
  async listCandidateTeachers(classId: string, context: CoverContext) {
    await this.assertCanManage(classId, context);
    const classTeacher = await this.currentClassTeacherId(classId);
    return prisma.teacherProfile.findMany({
      where: {
        status: "ACTIVE",
        ...currentStaffWhere(),
        ...(classTeacher ? { id: { not: classTeacher } } : {}),
      },
      select: { id: true, firstName: true, lastName: true, staffNumber: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
  }

  /** Classes a teacher is covering today or later (for "My classes"). */
  async coversForTeacher(teacherProfileId: string) {
    return registerCoverRepository.findCurrentAndUpcomingForTeacher(
      teacherProfileId,
      getTodayUtcMidnight()
    );
  }

  /** True when the teacher has a cover for this class that includes `date`. */
  async isCovering(teacherProfileId: string, classId: string, date: Date): Promise<boolean> {
    const cover = await registerCoverRepository.findActiveForTeacherAndClass(
      teacherProfileId,
      classId,
      normalizeToUtcMidnight(date)
    );
    return !!cover;
  }

  /**
   * The daily (morning) register rule: head/deputy may always take it; otherwise only the
   * class teacher, or a teacher covering for them on that day.
   */
  async assertCanTakeDailyRegister(
    classId: string,
    date: Date,
    context: CoverContext & { teacherProfileId?: string },
    academicYearId?: string
  ): Promise<void> {
    if (isSchoolLeader(context.role)) return;

    const me = context.teacherProfileId ?? (await this.teacherProfileIdFor(context.userId));
    if (!me) {
      throw new UnauthorizedError("Only the class teacher can take this class's register");
    }
    const classTeacher = await this.currentClassTeacherId(classId, academicYearId);
    if (classTeacher === me) return;
    if (await this.isCovering(me, classId, date)) return;

    throw new UnauthorizedError(
      "Only the class teacher (or a teacher covering for them) can take this class's register"
    );
  }
}

export const registerCoverService = new RegisterCoverService();
