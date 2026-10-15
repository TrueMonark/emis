/**
 * Year levels (Phase 3b): each school has its own list — "Grade 8", "Form 1", "Reception",
 * "Level 2", "16+" — described by stage, curriculum and national exam rather than a fixed
 * grade number, so Grade 9 and Form 1 can run side by side during the Grade → Form changeover.
 *
 * Sources: 2023 Zambia Education Curriculum Framework (Ch. 4, Table 12), summarised in
 * docs/research/reporting-research-2026-10.md (third pass).
 */

export type YearStage =
  | "ECE"
  | "LOWER_PRIMARY"
  | "UPPER_PRIMARY"
  | "JUNIOR_SECONDARY"
  | "O_LEVEL"
  | "A_LEVEL"
  | "LSEND"
  | "YALE";

export type Curriculum = "LEGACY_2013" | "CBC_2023";

export type NationalExam =
  | "NONE"
  | "PSLE_LEGACY"
  | "PSLE_2023"
  | "JSSL"
  | "SC_O_LEGACY"
  | "SC_O_2023"
  | "SC_A";

export const YEAR_STAGES: YearStage[] = [
  "ECE",
  "LOWER_PRIMARY",
  "UPPER_PRIMARY",
  "JUNIOR_SECONDARY",
  "O_LEVEL",
  "A_LEVEL",
  "LSEND",
  "YALE",
];

export const STAGE_LABELS: Record<YearStage, string> = {
  ECE: "Early childhood (ECE)",
  LOWER_PRIMARY: "Lower primary",
  UPPER_PRIMARY: "Upper primary",
  JUNIOR_SECONDARY: "Junior secondary (2013 curriculum)",
  O_LEVEL: "O-level / senior secondary",
  A_LEVEL: "A-level",
  LSEND: "LSEND (Levels 1–3, 16+)",
  YALE: "Youth and adult literacy (YALE)",
};

export const CURRICULUM_LABELS: Record<Curriculum, string> = {
  LEGACY_2013: "2013 curriculum",
  CBC_2023: "2023 curriculum",
};

export const EXAM_LABELS: Record<NationalExam, string> = {
  NONE: "No national exam",
  PSLE_LEGACY: "Primary School Leaving Exam (Grade 7, old)",
  PSLE_2023: "Primary School Leaving Exam (Grade 6, new)",
  JSSL: "Junior Secondary School Leaving Exam (Grade 9, last sat 2025)",
  SC_O_LEGACY: "School Certificate (Grade 12, old)",
  SC_O_2023: "School Certificate O-level (Form 4, new)",
  SC_A: "School Certificate A-level (Form 6)",
};

/** Exams whose grading ECZ hasn't published yet; the matching old scale is used meanwhile. */
export const PROVISIONAL_GRADING_EXAMS: NationalExam[] = ["PSLE_2023", "SC_O_2023", "SC_A"];

/** PRIMARY for ECE and the primary stages, SECONDARY for everything else. */
export function schoolLevelForStage(stage: YearStage): "PRIMARY" | "SECONDARY" {
  return stage === "ECE" || stage === "LOWER_PRIMARY" || stage === "UPPER_PRIMARY"
    ? "PRIMARY"
    : "SECONDARY";
}

/** What any piece of code needs to know about a year level to apply the rules. */
export interface YearLevelInfo {
  stage?: YearStage | string | null;
  curriculum?: Curriculum | string | null;
  exam?: NationalExam | string | null;
  /** Old fixed grade number (GRADE_1 … GRADE_12), when there is one */
  level?: string | null;
  name?: string | null;
}

/** True for "Form 1".."Form 6" or the short "F1-A" / "F2 Blue" class style. */
export function isFormNamed(name?: string | null): boolean {
  return !!name && /\bForm\s*[1-9]\b|^F[1-9][\s\-]/i.test(name.trim());
}

/**
 * Which ECZ grading scale applies: PRIMARY, JUNIOR (2013 Grades 8–9, JSSL) or SENIOR (9-point,
 * School Certificate and above). A Form-named class inside a junior-secondary year level is
 * treated as senior, as before Phase 3b (schools that named Grade 8/9 classes "F1-A").
 */
export function gradingScaleFor(
  yearLevel: YearLevelInfo,
  className?: string | null
): "PRIMARY" | "JUNIOR" | "SENIOR" {
  const stage = yearLevel.stage ?? stageFromLegacyLevel(yearLevel.level, yearLevel.name);
  switch (stage) {
    case "ECE":
    case "LOWER_PRIMARY":
    case "UPPER_PRIMARY":
      return "PRIMARY";
    case "JUNIOR_SECONDARY":
      return isFormNamed(yearLevel.name) || isFormNamed(className) ? "SENIOR" : "JUNIOR";
    default:
      return "SENIOR";
  }
}

/** Which report card document: the Junior Secondary one, or the Senior one (used for all others). */
export function reportCardTypeFor(
  yearLevel: YearLevelInfo,
  className?: string | null
): "JUNIOR" | "SENIOR" {
  return gradingScaleFor(yearLevel, className) === "JUNIOR" ? "JUNIOR" : "SENIOR";
}

/**
 * The legacy School Certificate (Grade 12) reports Physics and Chemistry as one "Science"
 * result. New-curriculum levels split them, so the merge only applies to SC_O_LEGACY.
 */
export function mergesPhysicsAndChemistry(yearLevel: YearLevelInfo): boolean {
  if (yearLevel.exam) return yearLevel.exam === "SC_O_LEGACY";
  return yearLevel.level === "GRADE_12";
}

/** Stage of an old GRADE_n value (used to fill in the stage of pre-Phase-3b grades). */
export function stageFromLegacyLevel(
  level?: string | null,
  name?: string | null
): YearStage | null {
  if (name && /^\s*form\s*[1-4]\b/i.test(name)) return "O_LEVEL";
  if (name && /^\s*form\s*[5-6]\b/i.test(name)) return "A_LEVEL";
  const n = level ? parseInt(level.replace("GRADE_", ""), 10) : NaN;
  if (Number.isNaN(n)) return null;
  if (n <= 4) return "LOWER_PRIMARY";
  if (n <= 7) return "UPPER_PRIMARY";
  if (n <= 9) return "JUNIOR_SECONDARY";
  return "O_LEVEL";
}

// ── Templates ──────────────────────────────────────────────────────────────────────────────

export interface YearLevelTemplateItem {
  name: string;
  shortName: string;
  stage: YearStage;
  curriculum: Curriculum;
  exam: NationalExam;
  /** Old grade number for 2013-curriculum grades */
  level?: string;
  /** Name of the level learners normally move to (Table 12 default) */
  next?: string;
}

export type YearLevelTemplateKey =
  | "PRIMARY_2023"
  | "SECONDARY_2023"
  | "CHANGEOVER_2026_SECONDARY"
  | "LEGACY_GRADES_1_12";

export interface YearLevelTemplate {
  key: YearLevelTemplateKey;
  label: string;
  description: string;
  levels: YearLevelTemplateItem[];
}

const g = (
  n: number,
  stage: YearStage,
  exam: NationalExam = "NONE",
  next?: string
): YearLevelTemplateItem => ({
  name: `Grade ${n}`,
  shortName: `G${n}`,
  stage,
  curriculum: "LEGACY_2013",
  exam,
  level: `GRADE_${n}`,
  next,
});

const f = (n: number, exam: NationalExam = "NONE", next?: string): YearLevelTemplateItem => ({
  name: `Form ${n}`,
  shortName: `F${n}`,
  stage: n <= 4 ? "O_LEVEL" : "A_LEVEL",
  curriculum: "CBC_2023",
  exam,
  next,
});

export const YEAR_LEVEL_TEMPLATES: YearLevelTemplate[] = [
  {
    key: "PRIMARY_2023",
    label: "Primary Grades 1–6 (2023 curriculum)",
    description: "Lower primary Grades 1–3, upper primary Grades 4–6, new PSLE at Grade 6.",
    levels: [1, 2, 3, 4, 5, 6].map((n) => ({
      name: `Grade ${n}`,
      shortName: `G${n}`,
      stage: n <= 3 ? ("LOWER_PRIMARY" as const) : ("UPPER_PRIMARY" as const),
      curriculum: "CBC_2023" as const,
      exam: n === 6 ? ("PSLE_2023" as const) : ("NONE" as const),
      level: `GRADE_${n}`,
      next: n < 6 ? `Grade ${n + 1}` : "Form 1",
    })),
  },
  {
    key: "SECONDARY_2023",
    label: "Secondary Forms 1–6 (2023 curriculum)",
    description: "O-level Forms 1–4 (School Certificate at Form 4), A-level Forms 5–6.",
    levels: [
      f(1, "NONE", "Form 2"),
      f(2, "NONE", "Form 3"),
      f(3, "NONE", "Form 4"),
      f(4, "SC_O_2023", "Form 5"),
      f(5, "NONE", "Form 6"),
      f(6, "SC_A"),
    ],
  },
  {
    key: "CHANGEOVER_2026_SECONDARY",
    label: "Changeover 2026 (secondary)",
    description:
      "Old Grades 10–12 finishing the School Certificate, new Forms 1–2 and Form 5. Grade 12 moves on to Form 5.",
    levels: [
      f(1, "NONE", "Form 2"),
      f(2, "NONE", "Form 3"),
      f(3, "NONE", "Form 4"),
      f(4, "SC_O_2023", "Form 5"),
      g(10, "O_LEVEL", "NONE", "Grade 11"),
      g(11, "O_LEVEL", "NONE", "Grade 12"),
      g(12, "O_LEVEL", "SC_O_LEGACY", "Form 5"),
      f(5, "NONE", "Form 6"),
      f(6, "SC_A"),
    ],
  },
  {
    key: "LEGACY_GRADES_1_12",
    label: "Grades 1–12 (2013 curriculum)",
    description: "The old structure: PSLE at Grade 7, JSSL at Grade 9, School Certificate at Grade 12.",
    levels: [
      g(1, "LOWER_PRIMARY", "NONE", "Grade 2"),
      g(2, "LOWER_PRIMARY", "NONE", "Grade 3"),
      g(3, "LOWER_PRIMARY", "NONE", "Grade 4"),
      g(4, "LOWER_PRIMARY", "NONE", "Grade 5"),
      g(5, "UPPER_PRIMARY", "NONE", "Grade 6"),
      g(6, "UPPER_PRIMARY", "NONE", "Grade 7"),
      g(7, "UPPER_PRIMARY", "PSLE_LEGACY", "Form 1"),
      g(8, "JUNIOR_SECONDARY", "NONE", "Grade 9"),
      g(9, "JUNIOR_SECONDARY", "JSSL", "Grade 10"),
      g(10, "O_LEVEL", "NONE", "Grade 11"),
      g(11, "O_LEVEL", "NONE", "Grade 12"),
      g(12, "O_LEVEL", "SC_O_LEGACY", "Form 5"),
    ],
  },
];

export function getYearLevelTemplate(key: string): YearLevelTemplate | undefined {
  return YEAR_LEVEL_TEMPLATES.find((t) => t.key === key);
}
