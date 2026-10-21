import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { isWeekend } from "@school/shared/calendar/weekend";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { getTodayUtcMidnight, normalizeToUtcMidnight } from "@/lib/utils/date-utils";
import { logger } from "@/lib/logger/logger";
import { specialClassRepository, type SpecialClassRow } from "./specialClass.repository";
import type { CreateSpecialClassInput, SpecialClassRegisterInput } from "./specialClass.validation";

export interface SpecialClassContext {
  userId: string;
  role: string;
}

/** Which list: my own, ones waiting for me to decide, or every one (head/deputy). */
export type SpecialClassView = "mine" | "to-approve" | "all";

/**
 * Special (weekend) classes (requested 18 October 2026).
 *
 * No attendance is taken on a Saturday or Sunday (attendanceRecord.service.ts refuses it),
 * except for a special class:
 *  1. the teacher asks for one, for a class and subject they teach, on a weekend day in a term;
 *  2. the HOD of the subject's department approves it (or turns it down). The head teacher and
 *     deputy can decide too: they're the fallback when there's no HOD or the teacher is the HOD.
 *     A head's or deputy's own special class needs no approval;
 *  3. on the day (or after), the teacher who asked takes its register. The head or deputy can
 *     correct it. Its attendance is kept apart from the daily register, so it never changes
 *     report-card attendance.
 */
export class SpecialClassService {
  private async teacherOf(ctx: SpecialClassContext) {
    const teacher = await specialClassRepository.findTeacherByUserId(ctx.userId);
    if (!teacher) throw new ForbiddenError("Only teaching staff can ask for a special class");
    return teacher;
  }

  /** Whether this person may approve or turn down the class. */
  private async canDecide(sc: SpecialClassRow, ctx: SpecialClassContext): Promise<boolean> {
    if (sc.teacher.userId === ctx.userId) return false; // nobody approves their own
    if (isSchoolLeader(ctx.role)) return true;
    const hodOf = await specialClassRepository.findHodDepartmentId(ctx.userId);
    return !!hodOf && hodOf.id === sc.subject.departmentId;
  }

  async create(input: CreateSpecialClassInput, ctx: SpecialClassContext) {
    const teacher = await this.teacherOf(ctx);
    const date = normalizeToUtcMidnight(input.date);
    if (!isWeekend(date)) {
      throw new ValidationError("Special classes are for Saturdays and Sundays. Weekday lessons are on the timetable.");
    }
    if (date < getTodayUtcMidnight()) throw new ValidationError("That day has already passed");

    const term = await specialClassRepository.findTermForDate(date);
    if (!term) throw new ValidationError("That day isn't in a term of the current academic year");
    if (term.academicYear.isClosed) throw new ValidationError("The academic year is closed");

    const [klass, subject] = await Promise.all([
      specialClassRepository.findClass(input.classId),
      specialClassRepository.findSubjectWithHod(input.subjectId),
    ]);
    if (!klass) throw new NotFoundError("Class not found");
    if (!subject) throw new NotFoundError("Subject not found");

    const leader = isSchoolLeader(ctx.role);
    if (!leader && !(await specialClassRepository.teaches(teacher.id, klass.id, subject.id, term.academicYearId))) {
      throw new ForbiddenError(`You don't teach ${subject.name} in ${klass.grade.name} ${klass.name}`);
    }

    // One special class at a time for a class: no overlapping times that day.
    const sameDay = await specialClassRepository.findLiveOnDay(klass.id, date);
    const clash = sameDay.find((o) => input.startTime < o.endTime && o.startTime < input.endTime);
    if (clash) {
      throw new ConflictError(
        `${klass.grade.name} ${klass.name} already has ${clash.subject.name} from ${clash.startTime} to ${clash.endTime} that day`
      );
    }

    const created = await specialClassRepository.create({
      classId: klass.id,
      subjectId: subject.id,
      termId: term.id,
      teacherId: teacher.id,
      date,
      startTime: input.startTime,
      endTime: input.endTime,
      topic: input.topic,
      venue: input.venue || null,
      reason: input.reason || null,
      // A head's or deputy's own weekend class needs nobody's approval.
      ...(leader ? { status: "APPROVED" as const, decidedById: ctx.userId, decidedAt: new Date() } : {}),
    });

    if (!leader) {
      const hod = subject.department?.hodTeacher;
      const approvers =
        hod && hod.userId !== ctx.userId
          ? [hod.userId]
          : (await specialClassRepository.findSchoolLeaders(ctx.userId)).map((l) => l.userId);
      await this.notifySafely(
        ctx.userId,
        approvers,
        `Weekend class to approve: ${klass.grade.name} ${klass.name} ${subject.name}`,
        `${teacher.firstName} ${teacher.lastName} asks to teach ${subject.name} to ${klass.grade.name} ${klass.name} on ${fmtDay(date)}, ${input.startTime}–${input.endTime} (${input.topic}). Approve or turn it down under Weekend classes.`,
        created.id
      );
    }
    return present(created, { canDecide: false, isMine: true });
  }

  /** The classes and subjects this person can ask for a weekend class for. */
  async options(ctx: SpecialClassContext) {
    const year = await specialClassRepository.findActiveYear();
    if (!year) return [];
    let pairs;
    if (isSchoolLeader(ctx.role)) {
      pairs = await specialClassRepository.findAllClassSubjects();
    } else {
      const teacher = await this.teacherOf(ctx);
      pairs = await specialClassRepository.findTeachingPairs(teacher.id, year.id);
    }
    const seen = new Map<string, { classId: string; classLabel: string; subjectId: string; subjectName: string; order: number }>();
    for (const p of pairs) {
      const key = `${p.class.id}:${p.subject.id}`;
      if (!seen.has(key)) {
        seen.set(key, {
          classId: p.class.id,
          classLabel: `${p.class.grade.name} ${p.class.name}`,
          subjectId: p.subject.id,
          subjectName: p.subject.name,
          order: p.class.grade.sequence,
        });
      }
    }
    return [...seen.values()]
      .sort((a, b) => a.order - b.order || a.classLabel.localeCompare(b.classLabel) || a.subjectName.localeCompare(b.subjectName))
      .map((o) => ({ classId: o.classId, classLabel: o.classLabel, subjectId: o.subjectId, subjectName: o.subjectName }));
  }

  async list(view: SpecialClassView, ctx: SpecialClassContext) {
    const leader = isSchoolLeader(ctx.role);
    const teacher = await specialClassRepository.findTeacherByUserId(ctx.userId);
    let rows: SpecialClassRow[];
    if (view === "mine") {
      rows = teacher ? await specialClassRepository.findMany({ teacherId: teacher.id }) : [];
    } else if (view === "to-approve") {
      const hodOf = await specialClassRepository.findHodDepartmentId(ctx.userId);
      if (!leader && !hodOf) throw new ForbiddenError("Only HODs and the head teacher or deputy approve special classes");
      rows = await specialClassRepository.findMany({
        status: "PENDING",
        ...(leader ? {} : { subject: { departmentId: hodOf!.id } }),
        ...(teacher ? { teacherId: { not: teacher.id } } : {}),
      });
    } else {
      if (!leader) throw new ForbiddenError("Only the head teacher or deputy sees every special class");
      rows = await specialClassRepository.findMany({});
    }
    return Promise.all(
      rows.map(async (r) => present(r, { canDecide: r.status === "PENDING" && (await this.canDecide(r, ctx)), isMine: r.teacher.userId === ctx.userId }))
    );
  }

  async approve(id: string, ctx: SpecialClassContext, note?: string | null) {
    return this.decide(id, ctx, "APPROVED", note ?? null);
  }

  async reject(id: string, ctx: SpecialClassContext, note?: string | null) {
    return this.decide(id, ctx, "REJECTED", note ?? null);
  }

  private async decide(id: string, ctx: SpecialClassContext, status: "APPROVED" | "REJECTED", note: string | null) {
    const sc = await specialClassRepository.findById(id);
    if (!sc) throw new NotFoundError("Special class not found");
    if (!(await this.canDecide(sc, ctx))) {
      throw new ForbiddenError(
        sc.teacher.userId === ctx.userId
          ? "You can't approve your own special class"
          : "Only the HOD of this subject's department, or the head teacher or deputy, can decide this"
      );
    }
    if (sc.status !== "PENDING") throw new ValidationError("This special class has already been decided");
    const updated = await specialClassRepository.decide(id, status, ctx.userId, note);
    await this.notifySafely(
      ctx.userId,
      [sc.teacher.userId],
      `Weekend class ${status === "APPROVED" ? "approved" : "turned down"}: ${sc.class.grade.name} ${sc.class.name} ${sc.subject.name}`,
      status === "APPROVED"
        ? `Your ${sc.subject.name} class on ${fmtDay(sc.date)} (${sc.startTime}–${sc.endTime}) is approved. Take its register under Weekend classes on the day.`
        : `Your ${sc.subject.name} class on ${fmtDay(sc.date)} was turned down${note ? `: ${note}` : "."}`,
      sc.id
    );
    return present(updated, { canDecide: false, isMine: false });
  }

  /** Withdraw (the teacher who asked) or call off (head/deputy), before any register is taken. */
  async cancel(id: string, ctx: SpecialClassContext) {
    const sc = await specialClassRepository.findById(id);
    if (!sc) throw new NotFoundError("Special class not found");
    if (sc.teacher.userId !== ctx.userId && !isSchoolLeader(ctx.role)) {
      throw new ForbiddenError("Only the teacher who asked for it, or the head teacher or deputy, can cancel it");
    }
    if (sc.status !== "PENDING" && sc.status !== "APPROVED") throw new ValidationError("This special class isn't on any more");
    if (sc._count.attendance > 0) throw new ValidationError("Its register has already been taken, so it can't be cancelled");
    const updated = await specialClassRepository.decide(id, "CANCELLED", ctx.userId, null);
    return present(updated, { canDecide: false, isMine: sc.teacher.userId === ctx.userId });
  }

  /** May this person see the register? The teacher, HOD of the subject, class teacher, head/deputy. */
  private async assertCanView(sc: NonNullable<Awaited<ReturnType<typeof specialClassRepository.findById>>>, ctx: SpecialClassContext) {
    if (sc.teacher.userId === ctx.userId || isSchoolLeader(ctx.role)) return;
    const hodOf = await specialClassRepository.findHodDepartmentId(ctx.userId);
    if (hodOf && hodOf.id === sc.subject.departmentId) return;
    const teacher = await specialClassRepository.findTeacherByUserId(ctx.userId);
    if (teacher && (await specialClassRepository.isClassTeacher(teacher.id, sc.classId, sc.term.academicYearId)) > 0) return;
    throw new ForbiddenError("You can't see this special class");
  }

  async getRegister(id: string, ctx: SpecialClassContext) {
    const sc = await specialClassRepository.findById(id);
    if (!sc) throw new NotFoundError("Special class not found");
    await this.assertCanView(sc, ctx);
    const [roster, marks] = await Promise.all([
      specialClassRepository.findRoster(sc.classId, sc.term.academicYearId),
      specialClassRepository.findMarks(sc.id),
    ]);
    const byStudent = new Map(marks.map((m) => [m.studentId, m]));
    return {
      specialClass: present(sc, { canDecide: sc.status === "PENDING" && (await this.canDecide(sc, ctx)), isMine: sc.teacher.userId === ctx.userId }),
      canTakeRegister: this.registerProblem(sc, ctx) === null,
      registerProblem: this.registerProblem(sc, ctx),
      students: roster.map(({ student }) => ({
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        gender: student.gender,
        learnerNumber: student.learnerNumber,
        status: byStudent.get(student.id)?.status ?? null,
        remarks: byStudent.get(student.id)?.remarks ?? null,
      })),
    };
  }

  /** Why the register can't be taken now (null = it can). */
  private registerProblem(sc: NonNullable<Awaited<ReturnType<typeof specialClassRepository.findById>>>, ctx: SpecialClassContext): string | null {
    if (sc.teacher.userId !== ctx.userId && !isSchoolLeader(ctx.role)) {
      return "Only the teacher who asked for this class takes its register";
    }
    if (sc.status === "PENDING") return "This class is still waiting for the HOD's approval";
    if (sc.status !== "APPROVED") return "This class isn't on (turned down or cancelled)";
    if (sc.term.academicYear.isClosed) return "The academic year is closed";
    if (sc.date > getTodayUtcMidnight()) return `The register opens on the day of the class (${fmtDay(sc.date)})`;
    return null;
  }

  /** Take (or correct) the register of an approved special class. */
  async saveRegister(id: string, input: SpecialClassRegisterInput, ctx: SpecialClassContext) {
    const sc = await specialClassRepository.findById(id);
    if (!sc) throw new NotFoundError("Special class not found");
    const problem = this.registerProblem(sc, ctx);
    if (problem) throw new ForbiddenError(problem);

    const roster = new Set((await specialClassRepository.findRoster(sc.classId, sc.term.academicYearId)).map((r) => r.student.id));
    const notOnList = input.records.filter((r) => !roster.has(r.studentId));
    if (notOnList.length > 0) throw new ValidationError(`${notOnList.length} learner(s) aren't on this class's list`);

    const marker = await specialClassRepository.findTeacherByUserId(ctx.userId);
    await specialClassRepository.saveMarks(sc.id, marker?.id ?? null, input.records);
    return { saved: input.records.length };
  }

  private async notifySafely(senderId: string, to: string[], subject: string, message: string, id: string) {
    try {
      await specialClassRepository.notify(senderId, to, subject, message, id);
    } catch (error) {
      logger.error("Special class notification failed", error instanceof Error ? error : undefined, { specialClassId: id });
    }
  }
}

function fmtDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function present(r: SpecialClassRow, flags: { canDecide: boolean; isMine: boolean }) {
  return {
    id: r.id,
    version: r.version,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    topic: r.topic,
    venue: r.venue,
    reason: r.reason,
    status: r.status,
    decisionNote: r.decisionNote,
    decidedAt: r.decidedAt,
    class: { id: r.class.id, label: `${r.class.grade.name} ${r.class.name}` },
    subject: { id: r.subject.id, name: r.subject.name },
    teacher: { id: r.teacher.id, name: `${r.teacher.firstName} ${r.teacher.lastName}` },
    registerTaken: r._count.attendance > 0,
    ...flags,
  };
}

export const specialClassService = new SpecialClassService();
