import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import {
  deriveIndicators,
  EMPTY_FACILITIES,
  missingFacilities,
  sumFacilities,
  sumFigures,
  type FacilitiesData,
  type LevelCount,
  type ReturnFigures,
} from "@school/shared/returns/indicators";
import type { SchoolFacilities } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { requireSchoolId } from "@/lib/db/tenant";
import { auditService } from "@/features/audit/audit.service";
import { calendarService } from "@/features/calendar/calendar.service";
import { officeService, type OfficeContext } from "@/features/offices/office.service";
import { indicatorsRepository, type IndicatorRow, type SchoolInScope } from "./indicators.repository";
import type { FacilitiesInput } from "./indicators.validation";

const DAY = 86_400_000;

/** Today in Zambia, YYYY-MM-DD. */
export function todayInZambia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lusaka" }).format(new Date());
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export interface Period {
  from: string;
  to: string;
}

/** The period asked for, or the last 30 days. At most a year; never past today. */
export function resolvePeriod(from?: string | null, to?: string | null): Period {
  const today = todayInZambia();
  const valid = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(asDate(s).getTime());
  let end = valid(to) ? to! : today;
  if (end > today) end = today;
  const start = valid(from) ? from! : isoDay(new Date(asDate(end).getTime() - 29 * DAY));
  if (start > end) throw new ValidationError("The start date is after the end date");
  if (asDate(end).getTime() - asDate(start).getTime() > 400 * DAY) throw new ValidationError("Choose at most a year");
  return { from: start, to: end };
}

export function facilitiesData(f: SchoolFacilities | null | undefined): FacilitiesData {
  if (!f) return { ...EMPTY_FACILITIES };
  return {
    classrooms: f.classrooms,
    desks: f.desks,
    toiletsBoys: f.toiletsBoys,
    toiletsGirls: f.toiletsGirls,
    toiletsStaff: f.toiletsStaff,
    waterSource: f.waterSource,
    power: f.power,
    internet: f.internet,
  };
}

function toFigures(row: IndicatorRow | undefined, levels: LevelCount[], period: Period): ReturnFigures {
  const r = row ?? ({} as Partial<IndicatorRow>);
  const n = (v: number | undefined) => Number(v ?? 0);
  return {
    period,
    learners: { male: n(r.learners_male), female: n(r.learners_female) },
    newLearners: { male: n(r.new_male), female: n(r.new_female) },
    leavers: { male: n(r.left_male), female: n(r.left_female) },
    repeaters: { male: n(r.repeaters_male), female: n(r.repeaters_female) },
    orphans: { male: n(r.orphans_male), female: n(r.orphans_female) },
    vulnerable: { male: n(r.vulnerable_male), female: n(r.vulnerable_female) },
    specialNeeds: { male: n(r.special_needs_male), female: n(r.special_needs_female) },
    byLevel: levels,
    teachers: {
      total: n(r.teachers),
      male: n(r.teachers_male),
      female: n(r.teachers_female),
      degree: n(r.teachers_degree),
      diploma: n(r.teachers_diploma),
      certificate: n(r.teachers_certificate),
    },
    classes: n(r.classes),
    attendance: { marks: n(r.attendance_marks), present: n(r.attendance_present) },
    registers: {
      taken: n(r.register_class_days),
      schoolDays: n(r.school_days),
      expected: n(r.classes) * n(r.school_days),
    },
  };
}

interface SchoolFigures {
  figures: ReturnFigures;
  facilities: FacilitiesData;
}

/** A group (district, province or one school) on the dashboard. */
function summarise(items: SchoolFigures[], period: Period) {
  const figures = sumFigures(items.map((i) => i.figures), period);
  const facilities = sumFacilities(items.map((i) => i.facilities));
  // Learners per classroom / desk / toilet only over the schools that gave their facilities.
  const reporting = items.filter((i) => missingFacilities(i.facilities).length === 0);
  const reportingFigures = sumFigures(reporting.map((i) => i.figures), period);
  const derived = deriveIndicators(figures, null);
  const fac = reporting.length
    ? deriveIndicators(reportingFigures, {
        ...EMPTY_FACILITIES,
        classrooms: facilities.classrooms,
        desks: facilities.desks,
        toiletsBoys: facilities.toiletsBoys,
        toiletsGirls: facilities.toiletsGirls,
      })
    : null;
  return {
    figures,
    facilities,
    derived: {
      ...derived,
      learnersPerClassroom: fac?.learnersPerClassroom ?? null,
      learnersPerDesk: fac?.learnersPerDesk ?? null,
      boysPerToilet: fac?.boysPerToilet ?? null,
      girlsPerToilet: fac?.girlsPerToilet ?? null,
    },
  };
}

/**
 * School profile indicators (Phase 7): the Ministry's School Profile figures, worked out live
 * from each school's records, for the school itself and the offices over it.
 *
 * Offices only ever get counts (the SQL functions return nothing else), and only for schools in
 * their area (`officeService.schoolWhere`). A school gets its own figures and its district's
 * totals to compare with.
 */
export class IndicatorsService {
  /** Figures for each school (one database call for all of them). */
  async figuresFor(schoolIds: string[], period: Period): Promise<Map<string, ReturnFigures>> {
    const holidays = (await calendarService.publicHolidays(asDate(period.from), asDate(period.to))).map((h) => h.date);
    const [rows, levels] = await Promise.all([
      indicatorsRepository.indicators(schoolIds, period.from, period.to, holidays),
      indicatorsRepository.enrolmentByLevel(schoolIds),
    ]);
    const levelsBySchool = new Map<string, LevelCount[]>();
    for (const l of levels) {
      const list = levelsBySchool.get(l.school_id) ?? [];
      list.push({ grade: l.grade_name, stage: l.stage, male: Number(l.male), female: Number(l.female) });
      levelsBySchool.set(l.school_id, list);
    }
    const bySchool = new Map(rows.map((r) => [r.school_id, r]));
    return new Map(schoolIds.map((id) => [id, toFigures(bySchool.get(id), levelsBySchool.get(id) ?? [], period)]));
  }

  private async withFacilities(schoolIds: string[], period: Period): Promise<Map<string, SchoolFigures>> {
    const [figures, facilities] = await Promise.all([this.figuresFor(schoolIds, period), indicatorsRepository.facilities(schoolIds)]);
    const facBySchool = new Map(facilities.map((f) => [f.schoolId, f]));
    return new Map(
      schoolIds.map((id) => [id, { figures: figures.get(id)!, facilities: facilitiesData(facBySchool.get(id)) }])
    );
  }

  // ── Offices ───────────────────────────────────────────────────────────────────────────

  /**
   * The office dashboard. HQ sees provinces, a PEO its districts, a DEBS its schools; `officeId`
   * opens one province or district inside the caller's area.
   */
  async officeDashboard(ctx: OfficeContext, input: { officeId?: string | null; from?: string | null; to?: string | null }) {
    const period = resolvePeriod(input.from, input.to);
    const scope = await this.resolveScope(ctx, input.officeId);
    const schools = await indicatorsRepository.findSchools(scope.where);
    const data = await this.withFacilities(schools.map((s) => s.id), period);

    let rows: {
      id: string;
      name: string;
      kind: "PROVINCE" | "DISTRICT" | "SCHOOL";
      schools: number;
      emisNumber?: string | null;
      inSetup?: boolean;
      summary: ReturnType<typeof summarise>;
    }[];

    if (scope.office.type === "DISTRICT") {
      rows = schools.map((s) => ({
        id: s.id,
        name: s.name,
        kind: "SCHOOL" as const,
        schools: 1,
        emisNumber: s.emisNumber,
        inSetup: !s.setupCompletedAt,
        summary: summarise([data.get(s.id)!], period),
      }));
    } else {
      const groupOf = (s: SchoolInScope) =>
        scope.office.type === "PROVINCIAL" ? s.districtOffice.id : s.districtOffice.parentId ?? "unassigned";
      const groups = new Map<string, SchoolInScope[]>();
      for (const s of schools) groups.set(groupOf(s), [...(groups.get(groupOf(s)) ?? []), s]);
      const offices = await indicatorsRepository.findOffices([...groups.keys()]);
      const nameOf = new Map(offices.map((o) => [o.id, o.name]));
      rows = [...groups.entries()]
        .map(([id, list]) => ({
          id,
          name: nameOf.get(id) ?? "Not yet assigned",
          kind: scope.office.type === "PROVINCIAL" ? ("DISTRICT" as const) : ("PROVINCE" as const),
          schools: list.length,
          summary: summarise(list.map((s) => data.get(s.id)!), period),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      period,
      scope: { id: scope.office.id, name: scope.office.name, type: scope.office.type, parent: scope.parent },
      total: { schools: schools.length, ...summarise([...data.values()], period) },
      rows,
    };
  }

  /** One school's profile for an office: its figures beside its district's. */
  async officeSchoolProfile(ctx: OfficeContext, schoolId: string, input: { from?: string | null; to?: string | null }) {
    if (!(await officeService.isSchoolInScope(ctx, schoolId))) throw new NotFoundError("School not found");
    return this.profileOf(schoolId, resolvePeriod(input.from, input.to), true);
  }

  private async resolveScope(ctx: OfficeContext, officeId?: string | null) {
    const targetId = officeId || ctx.office.officeId;
    const ids = await officeService.officeIdsInScope(ctx);
    if (ids !== "ALL" && !ids.includes(targetId)) throw new NotFoundError("Office not found");
    const office = await indicatorsRepository.findOffice(targetId);
    if (!office) throw new NotFoundError("Office not found");
    const where =
      office.type === "HQ"
        ? {}
        : office.type === "PROVINCIAL"
          ? { districtOffice: { parentId: office.id } }
          : { districtOfficeId: office.id };
    const parent =
      office.id !== ctx.office.officeId && office.parentId
        ? await indicatorsRepository.findOffice(office.parentId).then((p) => (p ? { id: p.id, name: p.name, type: p.type } : null))
        : null;
    return { office, where, parent };
  }

  // ── The school's own profile ──────────────────────────────────────────────────────────

  async mySchoolProfile(ctx: { userId: string; role: string }, input: { from?: string | null; to?: string | null }) {
    if (!isSchoolLeader(ctx.role)) throw new ForbiddenError("The school profile is for the head teacher and deputy");
    return { ...(await this.profileOf(requireSchoolId(), resolvePeriod(input.from, input.to), false)), canEdit: true };
  }

  private async profileOf(schoolId: string, period: Period, forOffice: boolean) {
    const school = await indicatorsRepository.findSchool(schoolId);
    if (!school) throw new NotFoundError("School not found");
    const district = await indicatorsRepository.findSchools({ districtOfficeId: school.districtOfficeId });
    const ids = [...new Set([schoolId, ...district.map((s) => s.id)])];
    const data = await this.withFacilities(ids, period);
    const mine = data.get(schoolId)!;
    const facilitiesRow = (await indicatorsRepository.facilities([schoolId]))[0];
    return {
      period,
      school: {
        id: school.id,
        name: school.name,
        emisNumber: school.emisNumber,
        category: school.category,
        agency: school.agency,
        district: school.districtOffice.name,
        inSetup: !school.setupCompletedAt,
      },
      leaders: forOffice
        ? (await indicatorsRepository.findLeaders(schoolId)).map((m) => ({
            role: m.role,
            name: m.user.displayName || m.user.email,
            phone: m.user.phone,
          }))
        : undefined,
      figures: mine.figures,
      facilities: mine.facilities,
      facilitiesNotes: facilitiesRow?.notes ?? null,
      facilitiesUpdatedAt: facilitiesRow?.updatedAt ?? null,
      derived: summarise([mine], period).derived,
      district: { name: school.districtOffice.name, schools: district.length, ...summarise(district.map((s) => data.get(s.id)!), period) },
    };
  }

  async updateFacilities(ctx: { userId: string; role: string }, input: FacilitiesInput) {
    if (!isSchoolLeader(ctx.role)) throw new ForbiddenError("Only the head teacher or deputy update the school's facilities");
    const schoolId = requireSchoolId();
    const saved = await indicatorsRepository.upsertFacilities(schoolId, {
      classrooms: input.classrooms ?? null,
      desks: input.desks ?? null,
      toiletsBoys: input.toiletsBoys ?? null,
      toiletsGirls: input.toiletsGirls ?? null,
      toiletsStaff: input.toiletsStaff ?? null,
      waterSource: input.waterSource ?? null,
      power: input.power ?? null,
      internet: input.internet ?? null,
      notes: input.notes?.trim() || null,
      updatedById: ctx.userId,
    });
    await auditService.record({
      action: "FACILITIES_UPDATED",
      targetType: "SCHOOL",
      targetId: schoolId,
      schoolId,
      summary: "Updated the school's facilities",
      details: { ...facilitiesData(saved) },
    });
    return { facilities: facilitiesData(saved), notes: saved.notes, updatedAt: saved.updatedAt };
  }

  /** The school's facilities as they are now (for a new return). */
  async currentFacilities(schoolId: string): Promise<FacilitiesData> {
    return facilitiesData((await indicatorsRepository.facilities([schoolId]))[0]);
  }
}

export const indicatorsService = new IndicatorsService();
