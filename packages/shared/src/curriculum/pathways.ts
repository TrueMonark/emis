/**
 * O-level and A-level pathways and their subject rules, from the 2023 Curriculum Framework
 * (Fig. 4 p.25, combination rules pp.26–27, Fig. 5 p.30). Subjects are catalogue codes
 * (catalogue.ts). Checks only warn: the framework has gaps (for example, it gives no A-level
 * combinations), so a school can always go ahead.
 */
import type { YearStage } from "./year-levels";

export interface PathwayRuleChoice {
  /** How many to take from the list */
  count: number;
  from: string[];
  /** Plain description, e.g. "one Home Economics subject" */
  label: string;
}

export interface PathwayRules {
  /** Every learner on the pathway takes these */
  compulsory: string[];
  /** Compulsory unless the learner takes another subject (ICT unless Computer Science) */
  compulsoryUnlessTaking?: { code: string; unless: string }[];
  choose: PathwayRuleChoice[];
  minSubjects: number;
  maxSubjects: number;
  notes?: string[];
}

export interface PathwayData {
  code: string;
  name: string;
  stage: Extract<YearStage, "O_LEVEL" | "A_LEVEL">;
  rules: PathwayRules;
}

const O_CORE = ["ENG", "MATH", "CIVIC"];
const ICT_UNLESS_CS = [{ code: "ICT", unless: "CS" }];
const GROUP_1_EXCEPT_ENGLISH = ["LIT", "ZL", "LZL", "FRE", "CHI", "POR", "SWA"];
const GROUP_3_EXCEPT_CIVIC = ["GEO", "HIST", "RE"];
const GROUP_4_EXCEPT_AGRIC = ["BIO", "CHEM", "PHY"];
const FOREIGN_LANGUAGES = ["FRE", "CHI", "POR", "SWA"];

const o = (
  code: string,
  name: string,
  extra: Partial<PathwayRules> & { compulsory?: string[] } = {}
): PathwayData => ({
  code,
  name,
  stage: "O_LEVEL",
  rules: {
    compulsory: [...O_CORE, ...(extra.compulsory ?? [])],
    compulsoryUnlessTaking: [...ICT_UNLESS_CS, ...(extra.compulsoryUnlessTaking ?? [])],
    choose: extra.choose ?? [],
    minSubjects: extra.minSubjects ?? 6,
    maxSubjects: extra.maxSubjects ?? 7,
    notes: extra.notes,
  },
});

const A_LEVEL_NOTE =
  "The framework names the A-level pathways but not their subject combinations; only the 3–4 subject limit is checked.";

const a = (code: string, name: string): PathwayData => ({
  code,
  name,
  stage: "A_LEVEL",
  rules: { compulsory: [], choose: [], minSubjects: 3, maxSubjects: 4, notes: [A_LEVEL_NOTE] },
});

export const NATIONAL_PATHWAYS: PathwayData[] = [
  o("OL_NATSCI", "Natural Sciences (STEM)", { compulsory: ["BIO", "CHEM", "PHY"] }),
  o("OL_TECH", "Technology (STEM)", {
    compulsory: ["PHY", "CHEM"],
    choose: [{ count: 1, from: ["CS", "DT"], label: "Computer Science or Design and Technology" }],
  }),
  o("OL_AGRIC", "Agriculture (STEM)", { compulsory: ["AGRIC", "CHEM", "PHY"] }),
  o("OL_HEH", "Home Economics and Hospitality", {
    compulsory: ["BIO"],
    compulsoryUnlessTaking: [{ code: "CHEM", unless: "TT" }],
    choose: [
      { count: 1, from: ["FASH", "FOOD", "HOSP", "TT"], label: "one Home Economics and Hospitality subject" },
      { count: 1, from: FOREIGN_LANGUAGES, label: "one foreign language" },
    ],
    maxSubjects: 8,
    notes: ["Chemistry is optional for Travel and Tourism learners."],
  }),
  o("OL_SOCSCI", "Social Sciences", {
    choose: [
      { count: 1, from: GROUP_3_EXCEPT_CIVIC, label: "one more Social Sciences subject" },
      { count: 1, from: GROUP_1_EXCEPT_ENGLISH, label: "one more Language and Literature subject" },
      { count: 1, from: GROUP_4_EXCEPT_AGRIC, label: "one Natural Science (not Agricultural Science)" },
    ],
  }),
  o("OL_BUSFIN", "Business and Finance", {
    compulsory: ["POA", "COMM"],
    choose: [{ count: 1, from: GROUP_4_EXCEPT_AGRIC, label: "one Natural Science (not Agricultural Science)" }],
  }),
  o("OL_PCA", "Performing and Creative Arts", {
    compulsory: ["ZL"],
    choose: [
      { count: 1, from: ["MUS", "ART"], label: "Music or Art and Design" },
      { count: 1, from: ["LIT", "LZL"], label: "Literature in English or in a Zambian Language" },
    ],
  }),
  o("OL_PES", "Physical Education and Sports", {
    compulsory: ["BIO", "PE"],
    choose: [
      { count: 1, from: [...GROUP_3_EXCEPT_CIVIC, "CHEM", "PHY"], label: "one Social Science or Natural Science (not Agricultural Science)" },
    ],
  }),
  a("AL_STEM", "STEM"),
  a("AL_SSL", "Social Science and Languages"),
  a("AL_BUS", "Business Studies"),
  a("AL_PES", "Physical Education and Sports"),
  a("AL_PCA", "Performing and Creative Arts"),
];

export interface PathwayCheckResult {
  ok: boolean;
  warnings: string[];
}

/**
 * Checks a set of subjects (catalogue codes) against a pathway's rules. `nameOf` turns a code
 * into a readable name for the messages.
 */
export function checkPathwaySubjects(
  rules: PathwayRules,
  subjectCodes: string[],
  nameOf: (code: string) => string = (c) => c
): PathwayCheckResult {
  const taken = new Set(subjectCodes);
  const warnings: string[] = [];

  const missing = rules.compulsory.filter((c) => !taken.has(c));
  if (missing.length > 0) {
    warnings.push(`Missing compulsory: ${missing.map(nameOf).join(", ")}`);
  }
  for (const r of rules.compulsoryUnlessTaking ?? []) {
    if (!taken.has(r.code) && !taken.has(r.unless)) {
      warnings.push(`${nameOf(r.code)} is compulsory unless ${nameOf(r.unless)} is taken`);
    }
  }
  for (const choice of rules.choose) {
    const n = choice.from.filter((c) => taken.has(c)).length;
    if (n < choice.count) warnings.push(`Needs ${choice.label}`);
  }
  if (subjectCodes.length < rules.minSubjects) {
    warnings.push(`Only ${subjectCodes.length} subjects — at least ${rules.minSubjects} expected`);
  }
  if (subjectCodes.length > rules.maxSubjects) {
    warnings.push(`${subjectCodes.length} subjects — at most ${rules.maxSubjects} expected`);
  }
  return { ok: warnings.length === 0, warnings };
}
