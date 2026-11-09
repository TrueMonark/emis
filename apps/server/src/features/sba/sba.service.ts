import type { SbaSheetStatus } from "@prisma/client";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import {
  SBA_DEFAULT_MAX_MARKS,
  SBA_EVENT_LABELS,
  SBA_TASKS,
  sbaTermOf,
  sbaTotal,
  type SbaMarkValue,
  type SbaStatusValue,
} from "@school/shared/sba/sba";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { requireSchoolId } from "@/lib/db/tenant";
import { logger } from "@/lib/logger/logger";
import { officeService, type OfficeContext } from "@/features/offices/office.service";
import { sbaRepository, type SbaSheetRow } from "./sba.repository";
import type { ReviewSheetInput, SaveEntriesInput, UpdateTasksInput } from "./sba.validation";

interface Ctx {
  userId: string;
  role: string;
}

const OPEN: SbaSheetStatus[] = ["DRAFT", "RETURNED"];
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const fullName = (s: { firstName: string; middleName?: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
const classLabel = (c: { name: string; grade: { name: string } }) => `${c.grade.name} ${c.name}`;

/**
 * School Based Assessment score sheets (Phase 9b, decided 4 November 2026).
 *  - **Every teacher keeps their own sheet** for each subject they teach in each class that
 *    has SBA (2023-curriculum O-level, `hasSba`), per school year.
 *  - **Six tasks**, two per term, each set by the teacher like an assignment (name, date, what
 *    it's marked out of). Marks are entered against that maximum, plus each learner's ECZ
 *    examination number and an overall comment.
 *  - **Sign-off:** the teacher submits (every learner needs a mark or "absent" for every task)
 *    → the **HOD** of the subject's department approves or sends it back with a comment (the
 *    head or deputy can act for a department with no HOD; nobody approves their own) → the
 *    **head teacher or deputy confirms** it. The head or deputy can reopen it with a reason.
 *  - The printout follows the ECZ score sheet: last year's tasks and this year's, with totals.
 *  - The offices see **progress counts only** (`emis_sba_progress`), never marks.
 */
export class SbaService {
  // ── Who may do what ───────────────────────────────────────────────────────────────────

  private async who(ctx: Ctx) {
    const [teacher, hod] = await Promise.all([sbaRepository.findTeacherByUserId(ctx.userId), sbaRepository.findHodDepartmentId(ctx.userId)]);
    return { teacher, hodDepartmentId: hod?.id ?? null, leader: isSchoolLeader(ctx.role) };
  }

  private flags(sheet: SbaSheetRow, me: Awaited<ReturnType<SbaService["who"]>>) {
    const mine = !!me.teacher && sheet.teacherId === me.teacher.id;
    const hodOfIt = !!me.hodDepartmentId && sheet.subject.departmentId === me.hodDepartmentId;
    return {
      mine,
      canView: mine || hodOfIt || me.leader,
      canEdit: mine && OPEN.includes(sheet.status),
      canReview: sheet.status === "SUBMITTED" && !mine && (hodOfIt || me.leader),
      canConfirm: sheet.status === "HOD_APPROVED" && me.leader,
      canReopen: me.leader && (sheet.status === "HOD_APPROVED" || sheet.status === "CONFIRMED"),
    };
  }

  private async requireSheet(ctx: Ctx, id: string) {
    const sheet = await sbaRepository.findSheet(id);
    if (!sheet) throw new NotFoundError("SBA sheet not found");
    const me = await this.who(ctx);
    const flags = this.flags(sheet, me);
    if (!flags.canView) throw new NotFoundError("SBA sheet not found");
    return { sheet, me, flags };
  }

  private summary(sheet: SbaSheetRow, flags: ReturnType<SbaService["flags"]>) {
    return {
      id: sheet.id,
      year: sheet.academicYear.year,
      class: { id: sheet.class.id, label: classLabel(sheet.class) },
      subject: { id: sheet.subject.id, name: sheet.subject.name, department: sheet.subject.department?.name ?? null },
      teacher: { id: sheet.teacher.id, name: `${sheet.teacher.firstName} ${sheet.teacher.lastName}` },
      status: sheet.status as SbaStatusValue,
      submittedAt: sheet.submittedAt,
      confirmedAt: sheet.confirmedAt,
      updatedAt: sheet.updatedAt,
      ...flags,
    };
  }

  // ── Lists ─────────────────────────────────────────────────────────────────────────────

  /**
   * The SBA page: my own sheets (one per subject and class I teach, started or not); for an
   * HOD, the department's; for the head and deputy, the whole school's, with who hasn't
   * started.
   */
  async overview(ctx: Ctx) {
    const year = await sbaRepository.findActiveYear();
    const me = await this.who(ctx);
    if (!year) return { year: null, isLeader: me.leader, isHod: !!me.hodDepartmentId, mine: [], others: [], notStarted: [] };

    const scopeWhere = me.leader ? {} : me.hodDepartmentId ? { subject: { departmentId: me.hodDepartmentId } } : null;
    const [myAssignments, sheets, scopeAssignments] = await Promise.all([
      me.teacher ? sbaRepository.findTeachingAssignments({ teacherId: me.teacher.id, academicYearId: year.id }) : Promise.resolve([]),
      sbaRepository.findSheets({
        academicYearId: year.id,
        OR: [...(me.teacher ? [{ teacherId: me.teacher.id }] : []), ...(scopeWhere ? [scopeWhere] : [])],
      }),
      scopeWhere ? sbaRepository.findTeachingAssignments({ academicYearId: year.id, ...scopeWhere }) : Promise.resolve([]),
    ]);
    const key = (t: string, c: string, s: string) => `${t}|${c}|${s}`;
    const byKey = new Map(sheets.map((s) => [key(s.teacherId, s.classId, s.subjectId), s]));
    const sortAssign = <T extends { class: { name: string; grade: { sequence: number } }; subject: { name: string } }>(list: T[]) =>
      [...list].sort((a, b) => a.class.grade.sequence - b.class.grade.sequence || a.class.name.localeCompare(b.class.name) || a.subject.name.localeCompare(b.subject.name));

    const mine = sortAssign(myAssignments).map((a) => {
      const s = byKey.get(key(a.teacherId, a.classId, a.subjectId));
      return {
        classId: a.classId,
        subjectId: a.subjectId,
        classLabel: classLabel(a.class),
        subjectName: a.subject.name,
        sheet: s ? this.summary(s, this.flags(s, me)) : null,
      };
    });
    const others = sheets.filter((s) => !me.teacher || s.teacherId !== me.teacher.id).map((s) => this.summary(s, this.flags(s, me)));
    const notStarted = sortAssign(scopeAssignments)
      .filter((a) => !byKey.has(key(a.teacherId, a.classId, a.subjectId)) && (!me.teacher || a.teacherId !== me.teacher.id))
      .map((a) => ({ teacher: `${a.teacher.firstName} ${a.teacher.lastName}`, classLabel: classLabel(a.class), subjectName: a.subject.name }));
    return { year, isLeader: me.leader, isHod: !!me.hodDepartmentId, mine, others, notStarted };
  }

  // ── The sheet ─────────────────────────────────────────────────────────────────────────

  async start(ctx: Ctx, input: { classId: string; subjectId: string }) {
    const year = await sbaRepository.findActiveYear();
    if (!year) throw new ValidationError("There is no active school year");
    const me = await this.who(ctx);
    if (!me.teacher) throw new ForbiddenError("Only teaching staff keep SBA sheets");
    const teaches = await sbaRepository.findTeachingAssignments({
      teacherId: me.teacher.id,
      academicYearId: year.id,
      classId: input.classId,
      subjectId: input.subjectId,
    });
    if (teaches.length === 0) throw new ForbiddenError("You can only keep SBA sheets for subjects you teach in a class that has SBA");
    if (await sbaRepository.findSheetFor(year.id, input.classId, input.subjectId, me.teacher.id)) {
      throw new ConflictError("You've already started this sheet");
    }
    try {
      const sheet = await sbaRepository.createSheet(
        { academicYearId: year.id, classId: input.classId, subjectId: input.subjectId, teacherId: me.teacher.id },
        SBA_TASKS.map((n) => ({ number: n, title: `Task ${n}`, maxMarks: SBA_DEFAULT_MAX_MARKS })),
        ctx.userId
      );
      return this.get(ctx, sheet.id);
    } catch (error) {
      if (error && typeof error === "object" && (error as { code?: string }).code === "P2002") throw new ConflictError("You've already started this sheet");
      throw error;
    }
  }

  /** Learners on the sheet: this year's class list, plus anyone who left after being marked. */
  private async learners(sheet: SbaSheetRow) {
    const [roster, marks, notes] = await Promise.all([
      sbaRepository.findRoster(sheet.classId, sheet.academicYearId),
      sbaRepository.findMarks(sheet.id),
      sbaRepository.findNotes(sheet.id),
    ]);
    const onRoster = new Set(roster.map((r) => r.student.id));
    const leftIds = [...new Set(marks.map((m) => m.studentId))].filter((id) => !onRoster.has(id));
    const left = leftIds.length ? await sbaRepository.findStudents(leftIds) : [];
    const students = [...roster.map((r) => ({ ...r.student, left: false })), ...left.map((s) => ({ ...s, left: true }))].sort(
      (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    );
    const marksBy = new Map<string, Map<number, SbaMarkValue>>();
    for (const m of marks) {
      const map = marksBy.get(m.studentId) ?? new Map<number, SbaMarkValue>();
      map.set(m.task.number, { marks: m.marks, isAbsent: m.isAbsent });
      marksBy.set(m.studentId, map);
    }
    const notesBy = new Map(notes.map((n) => [n.studentId, n]));
    const tasks = sheet.tasks.map((t) => ({ number: t.number, maxMarks: t.maxMarks }));
    return students.map((s) => {
      const m = marksBy.get(s.id) ?? new Map<number, SbaMarkValue>();
      return {
        studentId: s.id,
        name: fullName(s),
        learnerNumber: s.learnerNumber,
        gender: s.gender,
        left: s.left,
        examinationNumber: notesBy.get(s.id)?.examinationNumber ?? null,
        comment: notesBy.get(s.id)?.comment ?? null,
        marks: Object.fromEntries(SBA_TASKS.map((n) => [n, m.get(n) ?? { marks: null, isAbsent: false }])),
        total: sbaTotal(tasks, m),
      };
    });
  }

  async get(ctx: Ctx, id: string) {
    const { sheet, flags } = await this.requireSheet(ctx, id);
    const [learners, events] = await Promise.all([this.learners(sheet), sbaRepository.findEvents(sheet.id)]);
    const ids = [...new Set([sheet.hodDecidedById, sheet.confirmedById, ...events.map((e) => e.byUserId)].filter((x): x is string => !!x))];
    const names = new Map((await sbaRepository.findUserNames(ids)).map((u) => [u.id, u.displayName || u.email]));
    return {
      ...this.summary(sheet, flags),
      reviewComment: sheet.reviewComment,
      hodDecidedAt: sheet.hodDecidedAt,
      hodDecidedBy: sheet.hodDecidedById ? names.get(sheet.hodDecidedById) ?? null : null,
      confirmedBy: sheet.confirmedById ? names.get(sheet.confirmedById) ?? null : null,
      tasks: sheet.tasks.map((t) => ({
        id: t.id,
        number: t.number,
        term: sbaTermOf(t.number),
        title: t.title,
        description: t.description,
        maxMarks: t.maxMarks,
        dueDate: ymd(t.dueDate),
      })),
      learners,
      incomplete: learners.filter((l) => !l.left && !l.total.complete).length,
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        label: SBA_EVENT_LABELS[e.action] ?? e.action,
        by: e.byUserId ? names.get(e.byUserId) ?? null : null,
        comment: e.comment,
        at: e.at,
      })),
    };
  }

  async updateTasks(ctx: Ctx, id: string, input: UpdateTasksInput) {
    const { sheet, flags } = await this.requireSheet(ctx, id);
    if (!flags.canEdit) throw new ForbiddenError(flags.mine ? "This sheet is with the HOD or head teacher" : "Only the teacher who keeps this sheet changes it");
    const own = new Map(sheet.tasks.map((t) => [t.id, t]));
    const highest = await sbaRepository.highestMarks(sheet.id);
    const tasks = input.tasks.map((t) => {
      const task = own.get(t.id);
      if (!task) throw new ValidationError("That task isn't on this sheet");
      const top = highest.get(t.id) ?? 0;
      if (t.maxMarks < top) throw new ValidationError(`Task ${task.number} already has a mark of ${top}; it can't be out of less than that`);
      return { id: t.id, title: t.title, description: t.description?.trim() || null, maxMarks: t.maxMarks, dueDate: t.dueDate ? new Date(`${t.dueDate}T00:00:00.000Z`) : null };
    });
    if (!(await sbaRepository.updateTasks(sheet.id, OPEN, tasks))) throw new ConflictError("The sheet has just been submitted");
    return this.get(ctx, id);
  }

  async saveEntries(ctx: Ctx, id: string, input: SaveEntriesInput) {
    const { sheet, flags } = await this.requireSheet(ctx, id);
    if (!flags.canEdit) throw new ForbiddenError(flags.mine ? "This sheet is with the HOD or head teacher" : "Only the teacher who keeps this sheet enters its marks");
    const tasks = new Map(sheet.tasks.map((t) => [t.id, t]));
    const roster = new Set((await sbaRepository.findRoster(sheet.classId, sheet.academicYearId)).map((r) => r.student.id));
    const marks = input.marks.map((m) => {
      const task = tasks.get(m.taskId);
      if (!task) throw new ValidationError("That task isn't on this sheet");
      if (!roster.has(m.studentId)) throw new ValidationError("That learner isn't in this class this year");
      if (!m.isAbsent && m.marks != null && m.marks > task.maxMarks) {
        throw new ValidationError(`Task ${task.number} is out of ${task.maxMarks}; ${m.marks} is too high`);
      }
      return { taskId: m.taskId, studentId: m.studentId, marks: m.isAbsent ? null : m.marks, isAbsent: m.isAbsent };
    });
    const notes = input.notes.map((n) => {
      if (!roster.has(n.studentId)) throw new ValidationError("That learner isn't in this class this year");
      return { studentId: n.studentId, examinationNumber: n.examinationNumber?.trim() || null, comment: n.comment?.trim() || null };
    });
    if (!(await sbaRepository.saveEntries(sheet.id, OPEN, marks, notes))) throw new ConflictError("The sheet has just been submitted");
    return this.get(ctx, id);
  }

  // ── Sign-off ──────────────────────────────────────────────────────────────────────────

  async submit(ctx: Ctx, id: string) {
    const { sheet, flags } = await this.requireSheet(ctx, id);
    if (!flags.canEdit) throw new ForbiddenError(flags.mine ? "This sheet has already been submitted" : "Only the teacher who keeps this sheet submits it");
    const learners = await this.learners(sheet);
    const current = learners.filter((l) => !l.left);
    if (current.length === 0) throw new ValidationError("There are no learners in this class this year");
    const missing = current.filter((l) => !l.total.complete).length;
    if (missing > 0) {
      throw new ValidationError(`${missing} learner(s) don't have a mark (or "absent") for every task yet`);
    }
    const ok = await sbaRepository.transition(
      sheet.id,
      OPEN,
      { status: "SUBMITTED", submittedAt: new Date() },
      { action: "SUBMITTED", byUserId: ctx.userId }
    );
    if (!ok) throw new ConflictError("This sheet has just been submitted");
    const hodUser = sheet.subject.department?.hodTeacherId ? await sbaRepository.findUserIdOfTeacher(sheet.subject.department.hodTeacherId) : null;
    const to = hodUser && hodUser !== ctx.userId ? [hodUser] : await sbaRepository.findSchoolLeaderIds(requireSchoolId());
    await this.notify(ctx.userId, to, "SBA sheet to check", `${sheet.teacher.firstName} ${sheet.teacher.lastName} submitted the SBA sheet for ${sheet.subject.name}, ${classLabel(sheet.class)}.`, sheet.id);
    return this.get(ctx, id);
  }

  async review(ctx: Ctx, id: string, input: ReviewSheetInput) {
    const { sheet, flags } = await this.requireSheet(ctx, id);
    if (!flags.canReview) {
      throw new ForbiddenError(flags.mine ? "Nobody approves their own SBA sheet" : "Only the HOD of the subject's department (or the head teacher or deputy) checks this sheet");
    }
    const approve = input.decision === "APPROVE";
    const comment = input.comment?.trim() || null;
    const ok = await sbaRepository.transition(
      sheet.id,
      ["SUBMITTED"],
      { status: approve ? "HOD_APPROVED" : "RETURNED", hodDecidedAt: new Date(), hodDecidedById: ctx.userId, reviewComment: comment },
      { action: approve ? "HOD_APPROVED" : "RETURNED", byUserId: ctx.userId, comment }
    );
    if (!ok) throw new ConflictError("This sheet isn't waiting for a decision any more");
    const teacherUser = sheet.teacher.userId;
    if (approve) {
      await this.notify(ctx.userId, await sbaRepository.findSchoolLeaderIds(requireSchoolId()), "SBA sheet to confirm", `The SBA sheet for ${sheet.subject.name}, ${classLabel(sheet.class)} (${sheet.teacher.firstName} ${sheet.teacher.lastName}) was approved by the HOD.`, sheet.id);
    } else {
      await this.notify(ctx.userId, [teacherUser], "SBA sheet sent back", `Your SBA sheet for ${sheet.subject.name}, ${classLabel(sheet.class)} was sent back: ${comment}`, sheet.id);
    }
    return this.get(ctx, id);
  }

  async confirm(ctx: Ctx, id: string) {
    const { sheet, flags } = await this.requireSheet(ctx, id);
    if (!flags.canConfirm) throw new ForbiddenError("The head teacher or deputy confirms a sheet after the HOD has approved it");
    const ok = await sbaRepository.transition(
      sheet.id,
      ["HOD_APPROVED"],
      { status: "CONFIRMED", confirmedAt: new Date(), confirmedById: ctx.userId },
      { action: "CONFIRMED", byUserId: ctx.userId }
    );
    if (!ok) throw new ConflictError("This sheet isn't waiting for confirmation any more");
    await this.notify(ctx.userId, [sheet.teacher.userId], "SBA sheet confirmed", `Your SBA sheet for ${sheet.subject.name}, ${classLabel(sheet.class)} was confirmed by the head teacher.`, sheet.id);
    return this.get(ctx, id);
  }

  async reopen(ctx: Ctx, id: string, comment: string) {
    const { sheet, flags } = await this.requireSheet(ctx, id);
    if (!flags.canReopen) throw new ForbiddenError("Only the head teacher or deputy reopens an approved or confirmed sheet");
    const ok = await sbaRepository.transition(
      sheet.id,
      ["HOD_APPROVED", "CONFIRMED"],
      { status: "RETURNED", reviewComment: comment, confirmedAt: null, confirmedById: null },
      { action: "REOPENED", byUserId: ctx.userId, comment }
    );
    if (!ok) throw new ConflictError("Only an approved or confirmed sheet can be reopened");
    await this.notify(ctx.userId, [sheet.teacher.userId], "SBA sheet reopened", `Your SBA sheet for ${sheet.subject.name}, ${classLabel(sheet.class)} was reopened: ${comment}`, sheet.id);
    return this.get(ctx, id);
  }

  private async notify(from: string, to: string[], subject: string, message: string, sheetId: string) {
    try {
      await sbaRepository.notify(from, to, subject, message, sheetId);
    } catch (error) {
      logger.error("SBA notification failed", error instanceof Error ? error : undefined, { sheetId });
    }
  }

  // ── The printout (ECZ score sheet layout) ─────────────────────────────────────────────

  /**
   * Everything the score sheet printout shows: last year's six tasks (from the sheet in the same
   * subject, whoever kept it) and this year's, the totals, the comments, and the names for the
   * signature lines.
   */
  async scoreSheet(ctx: Ctx, id: string) {
    const { sheet } = await this.requireSheet(ctx, id);
    const schoolId = requireSchoolId();
    const learners = await this.learners(sheet);
    const previousYear = await sbaRepository.findYear(sheet.academicYear.year - 1);
    const earlier = previousYear
      ? await sbaRepository.findEarlierSheets(previousYear.id, sheet.subject, learners.map((l) => l.studentId))
      : [];
    const earlierBy = new Map<string, { gradeName: string; tasks: { number: number; maxMarks: number; mark: SbaMarkValue | undefined }[]; examinationNumber: string | null; status: string }>();
    for (const e of earlier) {
      for (const l of learners) {
        if (earlierBy.has(l.studentId)) continue;
        const has = e.tasks.some((t) => t.marks.some((m) => m.studentId === l.studentId));
        if (!has) continue;
        earlierBy.set(l.studentId, {
          gradeName: e.class.grade.name,
          tasks: e.tasks.map((t) => {
            const m = t.marks.find((x) => x.studentId === l.studentId);
            return { number: t.number, maxMarks: t.maxMarks, mark: m ? { marks: m.marks, isAbsent: m.isAbsent } : undefined };
          }),
          examinationNumber: e.notes.find((n) => n.studentId === l.studentId)?.examinationNumber ?? null,
          status: e.status,
        });
      }
    }
    const [school, head] = await Promise.all([sbaRepository.findSchoolForPrint(schoolId), sbaRepository.findHeadTeacher(schoolId)]);
    const earlierGrade = [...earlierBy.values()][0]?.gradeName ?? null;
    const earlierMax = earlier[0]?.tasks.map((t) => ({ number: t.number, maxMarks: t.maxMarks })) ?? null;

    return {
      school: {
        name: school?.name ?? "",
        centreCode: school?.eczCentreCode ?? null,
        district: school?.districtOffice.name ?? "",
        province: school?.districtOffice.parent?.name ?? "",
      },
      subject: { name: sheet.subject.name, code: sheet.subject.catalogueSubject?.code ?? sheet.subject.code },
      year: sheet.academicYear.year,
      status: sheet.status,
      levels: { earlier: earlierGrade, current: sheet.class.grade.name },
      classLabel: classLabel(sheet.class),
      earlierTasks: earlierMax,
      currentTasks: sheet.tasks.map((t) => ({ number: t.number, maxMarks: t.maxMarks, title: t.title })),
      rows: learners
        .filter((l) => !l.left)
        .map((l) => {
          const e = earlierBy.get(l.studentId);
          const earlierTotal = e ? sbaTotal(e.tasks.map((t) => ({ number: t.number, maxMarks: t.maxMarks })), new Map(e.tasks.map((t) => [t.number, t.mark]))) : null;
          return {
            name: l.name,
            examinationNumber: l.examinationNumber ?? e?.examinationNumber ?? null,
            earlier: e ? Object.fromEntries(e.tasks.map((t) => [t.number, t.mark ?? null])) : null,
            earlierTotal: earlierTotal?.score ?? null,
            earlierConfirmed: e ? e.status === "CONFIRMED" : null,
            current: l.marks,
            currentTotal: l.total.score,
            grandTotal: Math.round(((earlierTotal?.score ?? 0) + l.total.score) * 10) / 10,
            comment: l.comment,
          };
        }),
      teacher: { name: `${sheet.teacher.firstName} ${sheet.teacher.lastName}`, tsNumber: sheet.teacher.staffNumber },
      headTeacher: head
        ? {
            name: head.user.profile ? `${head.user.profile.firstName} ${head.user.profile.lastName}` : head.user.displayName || head.user.email,
            tsNumber: head.user.profile?.staffNumber ?? null,
          }
        : null,
      confirmedAt: sheet.confirmedAt,
    };
  }

  async setCentreCode(ctx: Ctx, code: string | null) {
    if (!isSchoolLeader(ctx.role)) throw new ForbiddenError("Only the head teacher or deputy changes the ECZ centre code");
    return sbaRepository.setCentreCode(requireSchoolId(), code?.trim() || null);
  }

  // ── Offices: progress only ────────────────────────────────────────────────────────────

  async officeProgress(ctx: OfficeContext) {
    const schools = await officeService.schoolsInScopeForProgress(ctx);
    const rows = await sbaRepository.progress(schools.map((s) => s.id));
    const by = new Map(rows.map((r) => [r.school_id, r]));
    const list = schools.map((s) => {
      const r = by.get(s.id);
      const n = (v: number | undefined) => Number(v ?? 0);
      const started = n(r?.draft) + n(r?.submitted) + n(r?.returned) + n(r?.hod_approved) + n(r?.confirmed);
      return {
        schoolId: s.id,
        name: s.name,
        district: s.districtOffice.name,
        expected: n(r?.expected),
        notStarted: Math.max(0, n(r?.expected) - started),
        draft: n(r?.draft) + n(r?.returned),
        submitted: n(r?.submitted),
        hodApproved: n(r?.hod_approved),
        confirmed: n(r?.confirmed),
      };
    });
    const sum = (k: keyof (typeof list)[number]) => list.reduce((s, x) => s + (typeof x[k] === "number" ? (x[k] as number) : 0), 0);
    return {
      schools: list,
      total: {
        expected: sum("expected"),
        notStarted: sum("notStarted"),
        draft: sum("draft"),
        submitted: sum("submitted"),
        hodApproved: sum("hodApproved"),
        confirmed: sum("confirmed"),
      },
    };
  }
}

export const sbaService = new SbaService();
