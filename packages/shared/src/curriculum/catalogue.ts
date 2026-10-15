/**
 * National subject catalogue — the subject list of the 2023 Zambia Education Curriculum
 * Framework (O-level groups pp.25–26, periods Table 7 p.29, A-level Table 8 p.31; primary and
 * ECE learning areas pp.15–21). Facts only, summarised in
 * docs/research/reporting-research-2026-10.md; the framework itself stays out of the repo.
 *
 * Each school picks what it offers from this list (a school subject linked to a catalogue
 * entry) and can add local subjects of its own. The migration
 * 20261016090000_phase3b_year_levels loads this list; `npm run db:sync-catalogue` reloads it
 * after a change here.
 */
import type { YearStage } from "./year-levels";

export interface CatalogueSubjectData {
  code: string;
  name: string;
  groupName: string;
  /** O-level group number 1–9 */
  groupNumber?: number;
  stages: YearStage[];
  /** Default periods per week, by stage */
  periodsPerWeek?: Partial<Record<YearStage, number>>;
  compulsoryOLevel?: boolean;
}

const LANG = "Language and Literature";
const MATHS = "Mathematics";
const SOC = "Social Sciences";
const NAT = "Natural Sciences";
const PCA = "Performing and Creative Arts";
const HEH = "Home Economics and Hospitality";
const BUS = "Business and Finance";
const TECH = "Technology";
const PES = "Physical Education and Sports";
const OTHER = "Other";
const EARLY = "Early childhood and primary learning areas";

const OA: YearStage[] = ["O_LEVEL", "A_LEVEL"];

export const NATIONAL_SUBJECT_CATALOGUE: CatalogueSubjectData[] = [
  // Group 1 — Language and Literature
  { code: "ENG", name: "English Language", groupName: LANG, groupNumber: 1, stages: ["UPPER_PRIMARY", ...OA], periodsPerWeek: { O_LEVEL: 6, A_LEVEL: 6 }, compulsoryOLevel: true },
  { code: "LIT", name: "Literature in English", groupName: LANG, groupNumber: 1, stages: OA, periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 7.5 } },
  { code: "ZL", name: "Zambian Languages", groupName: LANG, groupNumber: 1, stages: ["UPPER_PRIMARY", ...OA], periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 7.5 } },
  { code: "LZL", name: "Literature in Zambian Languages", groupName: LANG, groupNumber: 1, stages: OA, periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 7.5 } },
  { code: "FRE", name: "French", groupName: LANG, groupNumber: 1, stages: OA, periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 4.5 } },
  { code: "CHI", name: "Chinese", groupName: LANG, groupNumber: 1, stages: OA, periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 4.5 } },
  { code: "POR", name: "Portuguese", groupName: LANG, groupNumber: 1, stages: OA, periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 4.5 } },
  { code: "SWA", name: "Swahili", groupName: LANG, groupNumber: 1, stages: OA, periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 4.5 } },

  // Group 2 — Mathematics
  { code: "MATH", name: "Mathematics", groupName: MATHS, groupNumber: 2, stages: ["UPPER_PRIMARY", ...OA], periodsPerWeek: { O_LEVEL: 6, A_LEVEL: 12 }, compulsoryOLevel: true },

  // Group 3 — Social Sciences
  { code: "GEO", name: "Geography", groupName: SOC, groupNumber: 3, stages: OA, periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 9 } },
  { code: "HIST", name: "History", groupName: SOC, groupNumber: 3, stages: OA, periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 6 } },
  { code: "RE", name: "Religious Education", groupName: SOC, groupNumber: 3, stages: ["O_LEVEL"], periodsPerWeek: { O_LEVEL: 5 } },
  { code: "RS", name: "Religious Studies", groupName: SOC, stages: ["A_LEVEL"], periodsPerWeek: { A_LEVEL: 6 } },
  { code: "CIVIC", name: "Civic Education", groupName: SOC, groupNumber: 3, stages: OA, periodsPerWeek: { O_LEVEL: 5, A_LEVEL: 6 }, compulsoryOLevel: true },
  { code: "ECON", name: "Economics", groupName: SOC, stages: ["A_LEVEL"], periodsPerWeek: { A_LEVEL: 6 } },

  // Group 4 — Natural Sciences
  { code: "AGRIC", name: "Agricultural Science", groupName: NAT, groupNumber: 4, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },
  { code: "BIO", name: "Biology", groupName: NAT, groupNumber: 4, stages: OA, periodsPerWeek: { O_LEVEL: 6, A_LEVEL: 12 } },
  { code: "CHEM", name: "Chemistry", groupName: NAT, groupNumber: 4, stages: OA, periodsPerWeek: { O_LEVEL: 6, A_LEVEL: 12 } },
  { code: "PHY", name: "Physics", groupName: NAT, groupNumber: 4, stages: OA, periodsPerWeek: { O_LEVEL: 6, A_LEVEL: 12 } },

  // Group 5 — Performing and Creative Arts
  { code: "MUS", name: "Music", groupName: PCA, groupNumber: 5, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },
  { code: "ART", name: "Art and Design", groupName: PCA, groupNumber: 5, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },

  // Group 6 — Home Economics and Hospitality
  { code: "FASH", name: "Fashion and Fabrics", groupName: HEH, groupNumber: 6, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },
  { code: "FOOD", name: "Food and Nutrition", groupName: HEH, groupNumber: 6, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },
  // Table 7 lists "Home Management" (12) but not Hospitality Management; 12 is assumed.
  { code: "HOSP", name: "Hospitality Management", groupName: HEH, groupNumber: 6, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },
  { code: "TT", name: "Travel and Tourism", groupName: HEH, groupNumber: 6, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },

  // Group 7 — Business and Finance
  { code: "POA", name: "Principles of Accounts", groupName: BUS, groupNumber: 7, stages: ["O_LEVEL"], periodsPerWeek: { O_LEVEL: 5 } },
  { code: "COMM", name: "Commerce", groupName: BUS, groupNumber: 7, stages: ["O_LEVEL"], periodsPerWeek: { O_LEVEL: 5 } },
  { code: "BS", name: "Business Studies", groupName: BUS, stages: ["A_LEVEL"], periodsPerWeek: { A_LEVEL: 6 } },
  { code: "ACC", name: "Accounting", groupName: BUS, stages: ["A_LEVEL"], periodsPerWeek: { A_LEVEL: 6 } },

  // Group 8 — Technology
  { code: "CS", name: "Computer Science", groupName: TECH, groupNumber: 8, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },
  { code: "ICT", name: "Information and Communication Technology", groupName: TECH, groupNumber: 8, stages: ["O_LEVEL"], periodsPerWeek: { O_LEVEL: 5 } },
  { code: "DT", name: "Design and Technology", groupName: TECH, groupNumber: 8, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },

  // Group 9 — Physical Education and Sports
  { code: "PE", name: "Physical Education", groupName: PES, groupNumber: 9, stages: OA, periodsPerWeek: { O_LEVEL: 12, A_LEVEL: 12 } },

  // For learners with visual impairment, Forms 1–4
  { code: "BRL", name: "Braille", groupName: OTHER, stages: ["O_LEVEL"], periodsPerWeek: { O_LEVEL: 5 } },

  // Primary and ECE learning areas
  { code: "SCI", name: "Science", groupName: EARLY, stages: ["UPPER_PRIMARY"] },
  { code: "SST", name: "Social Studies", groupName: EARLY, stages: ["UPPER_PRIMARY"] },
  { code: "TS", name: "Technology Studies", groupName: EARLY, stages: ["UPPER_PRIMARY"] },
  { code: "EXA", name: "Expressive Arts", groupName: EARLY, stages: ["UPPER_PRIMARY"] },
  { code: "HE", name: "Home Economics", groupName: EARLY, stages: ["UPPER_PRIMARY"] },
  { code: "LITLANG", name: "Literacy and Language", groupName: EARLY, stages: ["LOWER_PRIMARY"] },
  { code: "MATHSCI", name: "Mathematics and Science", groupName: EARLY, stages: ["LOWER_PRIMARY"] },
  { code: "CTS", name: "Creative and Technology Studies", groupName: EARLY, stages: ["ECE", "LOWER_PRIMARY"] },
  { code: "PRELIT", name: "Pre-Literacy and Language", groupName: EARLY, stages: ["ECE"] },
  { code: "PREMATH", name: "Pre-Mathematics and Science", groupName: EARLY, stages: ["ECE"] },
];

export function findCatalogueSubject(code: string): CatalogueSubjectData | undefined {
  return NATIONAL_SUBJECT_CATALOGUE.find((s) => s.code === code);
}
