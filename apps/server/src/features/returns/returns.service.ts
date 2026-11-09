import type { Prisma, SchoolReturnStatus } from "@prisma/client";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import {
  deriveIndicators,
  missingFacilities,
  RETURN_EVENT_LABELS,
  sumFacilities,
  sumFigures,
  type FacilitiesData,
  type ReturnFigures,
  type ReturnStatusValue,
} from "@school/shared/returns/indicators";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { requireSchoolId } from "@/lib/db/tenant";
import { auditService } from "@/features/audit/audit.service";
import { officeService, type OfficeContext } from "@/features/offices/office.service";
import { indicatorsService, todayInZambia } from "@/features/indicators/indicators.service";
import { returnsRepository, type ReturnRow, type RoundRow } from "./returns.repository";
import type { OpenRoundInput, ReviewInput, SaveDraftInput } from "./returns.validation";

interface SchoolCtx {
  userId: string;
  role: string;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const EDITABLE: SchoolReturnStatus[] = ["DRAFT", "RETURNED"];

function presentRound(r: RoundRow) {
  return {
    id: r.id,
    title: r.title,
    instructions: r.instructions,
    office: { id: r.office.id, name: r.office.name, type: r.office.type },
    periodStart: ymd(r.periodStart),
    periodEnd: ymd(r.periodEnd),
    dueDate: ymd(r.dueDate),
    status: r.status,
    overdue: r.status === "OPEN" && ymd(r.dueDate) < todayInZambia(),
    closedAt: r.closedAt,
    createdAt: r.createdAt,
  };
}

function countStatuses(statuses: ReturnStatusValue[]) {
  const counts: Record<ReturnStatusValue, number> = { NOT_STARTED: 0, DRAFT: 0, SUBMITTED: 0, RETURNED: 0, APPROVED: 0 };
  for (const s of statuses) counts[s]++;
  return counts;
}

/**
 * Returns (Phase 7, 31 October 2026, decisions 31 October 2026):
 *  - an office (HQ, PEO or DEBS; its head) **opens a round** with a period and a due date; every
 *    active school in its area answers it;
 *  - the head teacher or deputy **starts a draft**: the counts come from the school's records
 *    (`indicatorsService.figuresFor`), the facilities from the School profile page (the head can
 *    correct the return's copy), then **submits** it;
 *  - the **DEBS of the school's district** (head or officer: checking returns is the district
 *    statisticians' work) **approves** it or **sends it back** with a comment; the head corrects
 *    and submits again. The DEBS head can reopen an approved return;
 *  - the PEO and HQ see progress and the approved figures added up by district and province.
 * Every step is a history line (`school_return_events`, never changed).
 */
export class ReturnsService {
  // ── Offices ───────────────────────────────────────────────────────────────────────────

  private async requireVisibleRound(ctx: OfficeContext, roundId: string) {
    const round = await returnsRepository.findRound(roundId);
    const visible = await officeService.messageOfficeIdsFor(ctx);
    if (!round || (visible !== "ALL" && !visible.includes(round.officeId))) throw new NotFoundError("Return not found");
    return round;
  }

  /** Schools that answer this round and that the caller may see. */
  private roundSchoolsFor(ctx: OfficeContext, round: RoundRow, within?: Prisma.SchoolWhereInput) {
    return returnsRepository.findSchools({
      AND: [officeService.schoolsUnderOfficeWhere(round.office), officeService.schoolWhere(ctx), ...(within ? [within] : [])],
    });
  }

  async listRounds(ctx: OfficeContext) {
    const rounds = await returnsRepository.findRounds(await officeService.messageOfficeIdsFor(ctx));
    const out = [];
    for (const r of rounds) {
      const schools = await this.roundSchoolsFor(ctx, r);
      const returns = await returnsRepository.findStatuses([r.id], schools.map((s) => s.id));
      const byId = new Map(returns.map((x) => [x.schoolId, x.status as ReturnStatusValue]));
      out.push({
        ...presentRound(r),
        schools: schools.length,
        counts: countStatuses(schools.map((s) => byId.get(s.id) ?? "NOT_STARTED")),
        canManage: this.canManageRound(ctx, r),
      });
    }
    return { rounds: out, canOpen: ctx.office.role === "OFFICE_HEAD" };
  }

  private canManageRound(ctx: OfficeContext, r: RoundRow) {
    return ctx.office.role === "OFFICE_HEAD" && r.officeId === ctx.office.officeId;
  }

  async openRound(ctx: OfficeContext, input: OpenRoundInput) {
    if (ctx.office.role !== "OFFICE_HEAD") throw new ForbiddenError("Only the head of the office opens a return");
    if (asDate(input.periodEnd).getTime() - asDate(input.periodStart).getTime() > 400 * 86_400_000) {
      throw new ValidationError("A return's period can be at most a year");
    }
    const round = await returnsRepository.createRound({
      title: input.title,
      instructions: input.instructions?.trim() || null,
      officeId: ctx.office.officeId,
      periodStart: asDate(input.periodStart),
      periodEnd: asDate(input.periodEnd),
      dueDate: asDate(input.dueDate),
      openedById: ctx.userId,
    });
    await auditService.record({
      action: "RETURN_ROUND_OPENED",
      targetType: "OFFICE",
      targetId: round.id,
      officeId: ctx.office.officeId,
      summary: `Opened the return "${round.title}" (period ${input.periodStart} to ${input.periodEnd}, due ${input.dueDate})`,
    });
    return presentRound(round);
  }

  async setRoundStatus(ctx: OfficeContext, roundId: string, status: "OPEN" | "CLOSED") {
    const round = await this.requireVisibleRound(ctx, roundId);
    if (!this.canManageRound(ctx, round)) throw new ForbiddenError("Only the head of the office that opened this return can close or reopen it");
    if (round.status === status) return presentRound(round);
    const updated = await returnsRepository.updateRound(roundId, { status, closedAt: status === "CLOSED" ? new Date() : null });
    await auditService.record({
      action: status === "CLOSED" ? "RETURN_ROUND_CLOSED" : "RETURN_ROUND_REOPENED",
      targetType: "OFFICE",
      targetId: roundId,
      officeId: ctx.office.officeId,
      summary: `${status === "CLOSED" ? "Closed" : "Reopened"} the return "${round.title}"`,
    });
    return presentRound(updated);
  }

  /**
   * A round's progress: one row per school for a district, per district for a province, per
   * province for HQ (`officeId` opens one inside the caller's area). The totals are the
   * **approved** returns added up.
   */
  async roundDetail(ctx: OfficeContext, roundId: string, officeId?: string | null) {
    const round = await this.requireVisibleRound(ctx, roundId);
    const targetId = officeId || ctx.office.officeId;
    const ids = await officeService.officeIdsInScope(ctx);
    if (ids !== "ALL" && !ids.includes(targetId)) throw new NotFoundError("Office not found");
    const target = await returnsRepository.findOffice(targetId);
    if (!target) throw new NotFoundError("Office not found");

    const schools = await this.roundSchoolsFor(ctx, round, officeService.schoolsUnderOfficeWhere(target));
    const returns = await returnsRepository.findReturnsForRound(round.id, schools.map((s) => s.id));
    const bySchool = new Map(returns.map((r) => [r.schoolId, r]));
    const statusOf = (id: string) => (bySchool.get(id)?.status as ReturnStatusValue | undefined) ?? "NOT_STARTED";
    const period = { from: ymd(round.periodStart), to: ymd(round.periodEnd) };
    const approved = returns.filter((r) => r.status === "APPROVED");
    const approvedFigures = sumFigures(approved.map((r) => r.figures as unknown as ReturnFigures), period);
    const approvedFacilities = sumFacilities(approved.map((r) => r.facilities as unknown as FacilitiesData));

    let rows;
    if (target.type === "DISTRICT") {
      rows = schools.map((s) => {
        const r = bySchool.get(s.id);
        return {
          kind: "SCHOOL" as const,
          id: s.id,
          name: s.name,
          emisNumber: s.emisNumber,
          returnId: r?.id ?? null,
          status: statusOf(s.id),
          submittedAt: r?.submittedAt ?? null,
          reviewedAt: r?.reviewedAt ?? null,
          submissions: r?.submissionCount ?? 0,
        };
      });
    } else {
      const groupOf = (s: (typeof schools)[number]) =>
        target.type === "PROVINCIAL" ? s.districtOffice.id : s.districtOffice.parentId ?? "unassigned";
      const groups = new Map<string, string[]>();
      for (const s of schools) groups.set(groupOf(s), [...(groups.get(groupOf(s)) ?? []), s.id]);
      const names = new Map((await returnsRepository.findOffices([...groups.keys()])).map((o) => [o.id, o.name]));
      rows = [...groups.entries()]
        .map(([id, list]) => ({
          kind: target.type === "PROVINCIAL" ? ("DISTRICT" as const) : ("PROVINCE" as const),
          id,
          name: names.get(id) ?? "Not yet assigned",
          schools: list.length,
          counts: countStatuses(list.map(statusOf)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      round: { ...presentRound(round), canManage: this.canManageRound(ctx, round) },
      scope: { id: target.id, name: target.name, type: target.type },
      schools: schools.length,
      counts: countStatuses(schools.map((s) => statusOf(s.id))),
      approved: {
        returns: approved.length,
        figures: approvedFigures,
        facilities: approvedFacilities,
        derived: deriveIndicators(approvedFigures, null),
      },
      rows,
    };
  }

  /** One school's return, for an office over the school. */
  async officeGetReturn(ctx: OfficeContext, returnId: string) {
    const ret = await returnsRepository.findReturnById(returnId);
    if (!ret || !(await officeService.isSchoolInScope(ctx, ret.schoolId))) throw new NotFoundError("Return not found");
    const isDistrict = ctx.office.officeType === "DISTRICT" && ctx.office.officeId === ret.school.districtOfficeId;
    return {
      ...(await this.present(ret)),
      canReview: isDistrict && ret.status === "SUBMITTED",
      canReopen: isDistrict && ctx.office.role === "OFFICE_HEAD" && ret.status === "APPROVED",
    };
  }

  private requireSchoolsDistrict(ctx: OfficeContext, ret: ReturnRow) {
    if (ctx.office.officeType !== "DISTRICT" || ctx.office.officeId !== ret.school.districtOfficeId) {
      throw new ForbiddenError("Returns are checked by the DEBS office of the school's district");
    }
  }

  async review(ctx: OfficeContext, returnId: string, input: ReviewInput) {
    const ret = await returnsRepository.findReturnById(returnId);
    if (!ret || !(await officeService.isSchoolInScope(ctx, ret.schoolId))) throw new NotFoundError("Return not found");
    this.requireSchoolsDistrict(ctx, ret);
    const approve = input.decision === "APPROVE";
    const ok = await returnsRepository.transition(
      ret.id,
      ["SUBMITTED"],
      {
        status: approve ? "APPROVED" : "RETURNED",
        reviewedAt: new Date(),
        reviewedById: ctx.userId,
        reviewComment: input.comment?.trim() || null,
      },
      { action: approve ? "APPROVED" : "RETURNED", byUserId: ctx.userId, comment: input.comment?.trim() || null }
    );
    if (!ok) throw new ConflictError("This return isn't waiting for a decision any more (someone else may have just dealt with it)");
    await auditService.record({
      action: approve ? "RETURN_APPROVED" : "RETURN_SENT_BACK",
      targetType: "SCHOOL",
      targetId: ret.id,
      schoolId: ret.schoolId,
      officeId: ctx.office.officeId,
      summary: `${approve ? "Approved" : "Sent back"} ${ret.school.name}'s return "${ret.round.title}"${input.comment ? `: ${input.comment}` : ""}`,
    });
    return this.officeGetReturn(ctx, ret.id);
  }

  async reopen(ctx: OfficeContext, returnId: string, comment: string) {
    const ret = await returnsRepository.findReturnById(returnId);
    if (!ret || !(await officeService.isSchoolInScope(ctx, ret.schoolId))) throw new NotFoundError("Return not found");
    this.requireSchoolsDistrict(ctx, ret);
    if (ctx.office.role !== "OFFICE_HEAD") throw new ForbiddenError("Only the DEBS reopens an approved return");
    const ok = await returnsRepository.transition(
      ret.id,
      ["APPROVED"],
      { status: "RETURNED", reviewedAt: new Date(), reviewedById: ctx.userId, reviewComment: comment },
      { action: "REOPENED", byUserId: ctx.userId, comment }
    );
    if (!ok) throw new ConflictError("Only an approved return can be reopened");
    await auditService.record({
      action: "RETURN_REOPENED",
      targetType: "SCHOOL",
      targetId: ret.id,
      schoolId: ret.schoolId,
      officeId: ctx.office.officeId,
      summary: `Reopened ${ret.school.name}'s approved return "${ret.round.title}": ${comment}`,
    });
    return this.officeGetReturn(ctx, ret.id);
  }

  // ── The school ────────────────────────────────────────────────────────────────────────

  private requireLeader(ctx: SchoolCtx) {
    if (!isSchoolLeader(ctx.role)) throw new ForbiddenError("Returns are for the head teacher and deputy");
  }

  private async requireSchoolRound(roundId: string) {
    const schoolId = requireSchoolId();
    const round = await returnsRepository.findRound(roundId);
    if (!round || !(await officeService.messageOfficeIdsForSchool(schoolId)).includes(round.officeId)) {
      throw new NotFoundError("Return not found");
    }
    return { schoolId, round };
  }

  async schoolRounds(ctx: SchoolCtx) {
    this.requireLeader(ctx);
    const schoolId = requireSchoolId();
    const rounds = await returnsRepository.findRounds(await officeService.messageOfficeIdsForSchool(schoolId));
    const mine = await returnsRepository.findSchoolReturns(schoolId, rounds.map((r) => r.id));
    const byRound = new Map(mine.map((m) => [m.roundId, m]));
    return rounds.map((r) => {
      const m = byRound.get(r.id);
      return {
        ...presentRound(r),
        myStatus: (m?.status as ReturnStatusValue | undefined) ?? "NOT_STARTED",
        submittedAt: m?.submittedAt ?? null,
        reviewedAt: m?.reviewedAt ?? null,
      };
    });
  }

  async schoolGetReturn(ctx: SchoolCtx, roundId: string) {
    this.requireLeader(ctx);
    const { schoolId, round } = await this.requireSchoolRound(roundId);
    const ret = await returnsRepository.findReturn(roundId, schoolId);
    return {
      round: presentRound(round),
      return: ret ? await this.present(ret) : null,
      canStart: !ret && round.status === "OPEN",
      canEdit: !!ret && round.status === "OPEN" && EDITABLE.includes(ret.status),
    };
  }

  /** The period a round's figures cover, up to today. */
  private figuresPeriod(round: RoundRow) {
    const from = ymd(round.periodStart);
    const today = todayInZambia();
    if (from > today) throw new ValidationError(`This return's period starts on ${from}; it can be started from then`);
    const end = ymd(round.periodEnd);
    return { from, to: end < today ? end : today };
  }

  private async computeFigures(schoolId: string, round: RoundRow): Promise<ReturnFigures> {
    const period = this.figuresPeriod(round);
    const figures = (await indicatorsService.figuresFor([schoolId], period)).get(schoolId)!;
    return figures;
  }

  async start(ctx: SchoolCtx, roundId: string) {
    this.requireLeader(ctx);
    const { schoolId, round } = await this.requireSchoolRound(roundId);
    if (round.status !== "OPEN") throw new ValidationError("This return is closed");
    if (await returnsRepository.findReturn(roundId, schoolId)) throw new ConflictError("The return has already been started");
    const [figures, facilities] = await Promise.all([this.computeFigures(schoolId, round), indicatorsService.currentFacilities(schoolId)]);
    try {
      await returnsRepository.createReturn({
        roundId,
        schoolId,
        figures: figures as unknown as Prisma.InputJsonValue,
        facilities: facilities as unknown as Prisma.InputJsonValue,
        byUserId: ctx.userId,
      });
    } catch (error) {
      if (error && typeof error === "object" && (error as { code?: string }).code === "P2002") {
        throw new ConflictError("The return has already been started");
      }
      throw error;
    }
    return this.schoolGetReturn(ctx, roundId);
  }

  private async editableReturn(ctx: SchoolCtx, roundId: string) {
    this.requireLeader(ctx);
    const { schoolId, round } = await this.requireSchoolRound(roundId);
    if (round.status !== "OPEN") throw new ValidationError("This return is closed");
    const ret = await returnsRepository.findReturn(roundId, schoolId);
    if (!ret) throw new NotFoundError("Start the return first");
    if (!EDITABLE.includes(ret.status)) {
      throw new ValidationError(ret.status === "APPROVED" ? "This return has been approved" : "This return is with the DEBS");
    }
    return { schoolId, round, ret };
  }

  /** Work the counts out again from the records (they change as registers are taken). */
  async refresh(ctx: SchoolCtx, roundId: string) {
    const { schoolId, round, ret } = await this.editableReturn(ctx, roundId);
    const figures = await this.computeFigures(schoolId, round);
    const ok = await returnsRepository.transition(
      ret.id,
      EDITABLE,
      { figures: figures as unknown as Prisma.InputJsonValue, figuresAt: new Date() },
      { action: "REFRESHED", byUserId: ctx.userId }
    );
    if (!ok) throw new ConflictError("The return has just been submitted");
    return this.schoolGetReturn(ctx, roundId);
  }

  async save(ctx: SchoolCtx, roundId: string, input: SaveDraftInput) {
    const { ret } = await this.editableReturn(ctx, roundId);
    const facilities: FacilitiesData = {
      classrooms: input.facilities.classrooms ?? null,
      desks: input.facilities.desks ?? null,
      toiletsBoys: input.facilities.toiletsBoys ?? null,
      toiletsGirls: input.facilities.toiletsGirls ?? null,
      toiletsStaff: input.facilities.toiletsStaff ?? null,
      waterSource: input.facilities.waterSource ?? null,
      power: input.facilities.power ?? null,
      internet: input.facilities.internet ?? null,
    };
    const ok = await returnsRepository.transition(
      ret.id,
      EDITABLE,
      { facilities: facilities as unknown as Prisma.InputJsonValue, remarks: input.remarks?.trim() || null },
      { action: "SAVED", byUserId: ctx.userId }
    );
    if (!ok) throw new ConflictError("The return has just been submitted");
    return this.schoolGetReturn(ctx, roundId);
  }

  async submit(ctx: SchoolCtx, roundId: string) {
    const { schoolId, ret } = await this.editableReturn(ctx, roundId);
    const facilities = ret.facilities as unknown as FacilitiesData;
    const missing = missingFacilities(facilities);
    if (missing.length) throw new ValidationError(`Fill in the facilities first: ${missing.join(", ")}`);
    const ok = await returnsRepository.transition(
      ret.id,
      EDITABLE,
      { status: "SUBMITTED", submittedAt: new Date(), submittedById: ctx.userId, submissionCount: { increment: 1 } },
      {
        action: "SUBMITTED",
        byUserId: ctx.userId,
        figures: ret.figures as Prisma.InputJsonValue,
        facilities: ret.facilities as Prisma.InputJsonValue,
      }
    );
    if (!ok) throw new ConflictError("The return has just been submitted");
    await auditService.record({
      action: "RETURN_SUBMITTED",
      targetType: "SCHOOL",
      targetId: ret.id,
      schoolId,
      summary: `Submitted the return "${ret.round.title}"${ret.submissionCount > 0 ? ` (again, after correction)` : ""}`,
    });
    return this.schoolGetReturn(ctx, roundId);
  }

  // ── Shared ────────────────────────────────────────────────────────────────────────────

  private async present(ret: ReturnRow) {
    const events = await returnsRepository.findEvents(ret.id);
    const userIds = [
      ...new Set([ret.submittedById, ret.reviewedById, ...events.map((e) => e.byUserId)].filter((x): x is string => !!x)),
    ];
    const names = new Map((await returnsRepository.findUserNames(userIds)).map((u) => [u.id, u.displayName || u.email]));
    const figures = ret.figures as unknown as ReturnFigures;
    const facilities = ret.facilities as unknown as FacilitiesData;
    return {
      id: ret.id,
      status: ret.status,
      round: presentRound(ret.round),
      school: { id: ret.school.id, name: ret.school.name, emisNumber: ret.school.emisNumber, district: ret.school.districtOffice.name },
      figures,
      facilities,
      missingFacilities: missingFacilities(facilities),
      derived: deriveIndicators(figures, facilities),
      figuresAt: ret.figuresAt,
      remarks: ret.remarks,
      submissionCount: ret.submissionCount,
      submittedAt: ret.submittedAt,
      submittedBy: ret.submittedById ? names.get(ret.submittedById) ?? null : null,
      reviewedAt: ret.reviewedAt,
      reviewedBy: ret.reviewedById ? names.get(ret.reviewedById) ?? null : null,
      reviewComment: ret.reviewComment,
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        label: RETURN_EVENT_LABELS[e.action] ?? e.action,
        by: e.byUserId ? names.get(e.byUserId) ?? null : null,
        comment: e.comment,
        at: e.at,
      })),
    };
  }
}

export const returnsService = new ReturnsService();
