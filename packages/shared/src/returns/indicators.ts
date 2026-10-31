/**
 * School profile indicators and returns (Phase 7, 31 October 2026).
 *
 * The figures a school's return carries and the DEBS / PEO / HQ dashboards show. They follow the
 * categories of the Ministry's School Profile / Annual School Census (enrolment by year level and
 * sex, repeaters, leavers, orphans and vulnerable children, teachers, facilities) plus what this
 * system knows that the census doesn't: attendance and whether registers are being taken.
 *
 * Only counts travel above the school, never learners' names.
 */
import { YEAR_STAGES, STAGE_LABELS, type YearStage } from "../curriculum/year-levels";

export interface MaleFemale {
  male: number;
  female: number;
}

export interface LevelCount {
  grade: string;
  stage: string;
  male: number;
  female: number;
}

/** The counts in a return (worked out from the school's records). */
export interface ReturnFigures {
  /** YYYY-MM-DD: attendance, admissions and leavers are counted between these dates */
  period: { from: string; to: string };
  /** Learners on roll now */
  learners: MaleFemale;
  /** Admitted during the period */
  newLearners: MaleFemale;
  /** Withdrawn or transferred out during the period */
  leavers: MaleFemale;
  /** Repeating the year level this year */
  repeaters: MaleFemale;
  orphans: MaleFemale;
  vulnerable: MaleFemale;
  specialNeeds: MaleFemale;
  /** Learners in a class this year, by year level */
  byLevel: LevelCount[];
  teachers: { total: number; male: number; female: number; degree: number; diploma: number; certificate: number };
  classes: number;
  attendance: { marks: number; present: number };
  /** Class registers taken on school days, out of classes × school days */
  registers: { taken: number; schoolDays: number; expected: number };
}

export const WATER_SOURCES = ["PIPED", "BOREHOLE", "PROTECTED_WELL", "UNPROTECTED_WELL", "SURFACE_WATER", "RAINWATER", "NONE"] as const;
export type WaterSourceValue = (typeof WATER_SOURCES)[number];
export const WATER_SOURCE_LABELS: Record<WaterSourceValue, string> = {
  PIPED: "Piped (tap)",
  BOREHOLE: "Borehole",
  PROTECTED_WELL: "Protected well",
  UNPROTECTED_WELL: "Unprotected well",
  SURFACE_WATER: "River, stream or dam",
  RAINWATER: "Rainwater",
  NONE: "No water source",
};

export const POWER_SOURCES = ["GRID", "SOLAR", "GENERATOR", "NONE"] as const;
export type PowerSourceValue = (typeof POWER_SOURCES)[number];
export const POWER_SOURCE_LABELS: Record<PowerSourceValue, string> = {
  GRID: "ZESCO (grid)",
  SOLAR: "Solar",
  GENERATOR: "Generator",
  NONE: "No electricity",
};

/** A school's facilities as reported (empty = not given yet). */
export interface FacilitiesData {
  classrooms: number | null;
  desks: number | null;
  toiletsBoys: number | null;
  toiletsGirls: number | null;
  toiletsStaff: number | null;
  waterSource: WaterSourceValue | null;
  power: PowerSourceValue | null;
  internet: boolean | null;
}

export const EMPTY_FACILITIES: FacilitiesData = {
  classrooms: null,
  desks: null,
  toiletsBoys: null,
  toiletsGirls: null,
  toiletsStaff: null,
  waterSource: null,
  power: null,
  internet: null,
};

/** What's missing before a return can be submitted (empty = complete). */
export function missingFacilities(f: FacilitiesData): string[] {
  const missing: string[] = [];
  if (f.classrooms == null) missing.push("classrooms");
  if (f.desks == null) missing.push("desks");
  if (f.toiletsBoys == null || f.toiletsGirls == null) missing.push("toilets for boys and girls");
  if (f.waterSource == null) missing.push("water source");
  if (f.power == null) missing.push("electricity");
  return missing;
}

export const RETURN_STATUSES = ["NOT_STARTED", "DRAFT", "SUBMITTED", "RETURNED", "APPROVED"] as const;
export type ReturnStatusValue = (typeof RETURN_STATUSES)[number];
export const RETURN_STATUS_LABELS: Record<ReturnStatusValue, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  SUBMITTED: "Waiting for DEBS",
  RETURNED: "Sent back for correction",
  APPROVED: "Approved",
};

export const RETURN_EVENT_LABELS: Record<string, string> = {
  STARTED: "Draft started",
  REFRESHED: "Figures refreshed from the records",
  SAVED: "Draft saved",
  SUBMITTED: "Submitted to the DEBS",
  RETURNED: "Sent back for correction",
  APPROVED: "Approved",
  REOPENED: "Reopened by the DEBS",
};

// ── Derived indicators ──────────────────────────────────────────────────────────────────────

export const total = (mf: MaleFemale) => mf.male + mf.female;

/** a ÷ b to one decimal place, or null when b is 0 / unknown. */
export function ratio(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b <= 0) return null;
  return Math.round((a / b) * 10) / 10;
}

/** a as a percentage of b (one decimal), or null when b is 0 / unknown. Capped at 100. */
export function percent(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b <= 0) return null;
  return Math.min(100, Math.round((a / b) * 1000) / 10);
}

export interface DerivedIndicators {
  learners: number;
  girlsPercent: number | null;
  teachers: number;
  pupilTeacherRatio: number | null;
  /** Teachers with a diploma or degree (or higher) */
  qualifiedPercent: number | null;
  averageClassSize: number | null;
  attendancePercent: number | null;
  registersPercent: number | null;
  repeatersPercent: number | null;
  learnersPerClassroom: number | null;
  learnersPerDesk: number | null;
  boysPerToilet: number | null;
  girlsPerToilet: number | null;
}

export function deriveIndicators(fig: ReturnFigures, fac: FacilitiesData | null): DerivedIndicators {
  const learners = total(fig.learners);
  return {
    learners,
    girlsPercent: percent(fig.learners.female, learners),
    teachers: fig.teachers.total,
    pupilTeacherRatio: ratio(learners, fig.teachers.total),
    qualifiedPercent: percent(fig.teachers.degree + fig.teachers.diploma, fig.teachers.total),
    averageClassSize: ratio(learners, fig.classes),
    attendancePercent: percent(fig.attendance.present, fig.attendance.marks),
    registersPercent: percent(fig.registers.taken, fig.registers.expected),
    repeatersPercent: percent(total(fig.repeaters), learners),
    learnersPerClassroom: ratio(learners, fac?.classrooms),
    learnersPerDesk: ratio(learners, fac?.desks),
    boysPerToilet: ratio(fig.learners.male, fac?.toiletsBoys),
    girlsPerToilet: ratio(fig.learners.female, fac?.toiletsGirls),
  };
}

// ── Adding up schools (district, province, national) ────────────────────────────────────────

const addMF = (a: MaleFemale, b: MaleFemale): MaleFemale => ({ male: a.male + b.male, female: a.female + b.female });

const stageRank = (stage: string) => {
  const i = YEAR_STAGES.indexOf(stage as YearStage);
  return i < 0 ? YEAR_STAGES.length : i;
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage as YearStage] ?? stage;
}

/** Year levels across schools, combined by name within a stage ("Grade 8", "Form 1" stay apart). */
export function sumLevels(lists: LevelCount[][]): LevelCount[] {
  const map = new Map<string, LevelCount>();
  const order: string[] = [];
  for (const list of lists) {
    for (const l of list) {
      const key = `${l.stage}|${l.grade}`;
      const hit = map.get(key);
      if (hit) {
        hit.male += l.male;
        hit.female += l.female;
      } else {
        map.set(key, { ...l });
        order.push(key);
      }
    }
  }
  return order
    .map((k, i) => ({ l: map.get(k)!, i }))
    .sort((a, b) => stageRank(a.l.stage) - stageRank(b.l.stage) || a.i - b.i)
    .map((x) => x.l);
}

export function sumFigures(list: ReturnFigures[], period: { from: string; to: string }): ReturnFigures {
  const zero: MaleFemale = { male: 0, female: 0 };
  const out: ReturnFigures = {
    period,
    learners: zero,
    newLearners: zero,
    leavers: zero,
    repeaters: zero,
    orphans: zero,
    vulnerable: zero,
    specialNeeds: zero,
    byLevel: sumLevels(list.map((f) => f.byLevel)),
    teachers: { total: 0, male: 0, female: 0, degree: 0, diploma: 0, certificate: 0 },
    classes: 0,
    attendance: { marks: 0, present: 0 },
    registers: { taken: 0, schoolDays: 0, expected: 0 },
  };
  for (const f of list) {
    out.learners = addMF(out.learners, f.learners);
    out.newLearners = addMF(out.newLearners, f.newLearners);
    out.leavers = addMF(out.leavers, f.leavers);
    out.repeaters = addMF(out.repeaters, f.repeaters);
    out.orphans = addMF(out.orphans, f.orphans);
    out.vulnerable = addMF(out.vulnerable, f.vulnerable);
    out.specialNeeds = addMF(out.specialNeeds, f.specialNeeds);
    out.teachers = {
      total: out.teachers.total + f.teachers.total,
      male: out.teachers.male + f.teachers.male,
      female: out.teachers.female + f.teachers.female,
      degree: out.teachers.degree + f.teachers.degree,
      diploma: out.teachers.diploma + f.teachers.diploma,
      certificate: out.teachers.certificate + f.teachers.certificate,
    };
    out.classes += f.classes;
    out.attendance = { marks: out.attendance.marks + f.attendance.marks, present: out.attendance.present + f.attendance.present };
    out.registers = {
      taken: out.registers.taken + f.registers.taken,
      schoolDays: Math.max(out.registers.schoolDays, f.registers.schoolDays),
      expected: out.registers.expected + f.registers.expected,
    };
  }
  return out;
}

/**
 * Facilities across schools: counts are added up over the schools that gave them (`reported`
 * says how many did); water and power become counts per source.
 */
export interface FacilitiesSummary {
  schools: number;
  reported: number;
  classrooms: number;
  desks: number;
  toiletsBoys: number;
  toiletsGirls: number;
  toiletsStaff: number;
  water: Partial<Record<WaterSourceValue, number>>;
  power: Partial<Record<PowerSourceValue, number>>;
  internet: number;
}

export function sumFacilities(list: (FacilitiesData | null)[]): FacilitiesSummary {
  const out: FacilitiesSummary = {
    schools: list.length,
    reported: 0,
    classrooms: 0,
    desks: 0,
    toiletsBoys: 0,
    toiletsGirls: 0,
    toiletsStaff: 0,
    water: {},
    power: {},
    internet: 0,
  };
  for (const f of list) {
    if (!f || missingFacilities(f).length > 0) continue;
    out.reported++;
    out.classrooms += f.classrooms ?? 0;
    out.desks += f.desks ?? 0;
    out.toiletsBoys += f.toiletsBoys ?? 0;
    out.toiletsGirls += f.toiletsGirls ?? 0;
    out.toiletsStaff += f.toiletsStaff ?? 0;
    if (f.waterSource) out.water[f.waterSource] = (out.water[f.waterSource] ?? 0) + 1;
    if (f.power) out.power[f.power] = (out.power[f.power] ?? 0) + 1;
    if (f.internet) out.internet++;
  }
  return out;
}
