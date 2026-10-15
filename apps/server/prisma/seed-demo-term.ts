/**
 * DEMO SEED: "Kaliwe Heights Secondary School" (fictional)
 * =========================================================
 * Adds one fictional school, with a believable school year of activity, for screen-recording
 * product demos and for testing pages with a full school's worth of data:
 *
 *   - 2026 academic year, Terms 1 & 2 complete, Term 3 in progress (up to today)
 *   - 3 leadership staff + 18 teachers in 4 departments (4 HODs)
 *   - 8 classes (Form 1 A/B, Form 2 A/B, Grade 10 A/B, Grade 11 A, Grade 12 A), ~300 students
 *   - Guardians, curriculum, teacher assignments, class teachers, rooms
 *   - CAT / Mid-term / End-of-term assessments with realistic marks (ECZ grades)
 *   - Daily attendance registers for every school day so far
 *   - Generated timetable + lesson logs for Term 3
 *   - Report cards for Term 1 (all classes) and Term 2 (all except Grade 12 A,
 *     left un-generated on purpose so you can demo "Bulk Generate" live)
 *   - Term 3 Mid-term exams half-entered (for the HOD monitoring screens)
 *   - SMS logs, SMS templates, staff notifications
 *
 * EVERY PERSON, PHONE NUMBER AND EMAIL IN HERE IS MADE UP.
 * Emails use the reserved ".example" domain. Do NOT configure real SMS gateway
 * credentials on the demo database, or "send SMS" buttons could text random numbers.
 *
 * MANY SCHOOLS (Phase 3a): the demo is its own school in the database. Its data is kept apart
 * from every other school by the same row-level security the app uses, so it can sit next to a
 * real school in your local database. It refuses to run twice (the demo school already exists)
 * and refuses any database that isn't on this computer (like prisma/seed.ts).
 *
 * RUN (from apps/server, with DATABASE_URL pointing at a migrated LOCAL database):
 *     npx tsx prisma/seed-demo-term.ts
 *
 * Password for every demo account: DEMO_SEED_PASSWORD from apps/server/.env if set, otherwise a
 * random one printed at the end (no fixed, publicly known password in the code).
 */

import { config } from "dotenv";
config();

// Keep the shared Prisma client quiet (it logs every query in development).
Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV === "development" || !process.env.NODE_ENV ? "production" : process.env.NODE_ENV });

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { stageFromLegacyLevel } from "@school/shared/curriculum/year-levels";
import type {
  Prisma, Role, Permission, GradeLevel, SchoolLevel, TermType, Gender, QualificationLevel, RoomType,
  ParentRelationship, VulnerabilityStatus, AttendanceStatus, ExamType, AssessmentStatus, ECZGrade,
} from "@prisma/client";

// ───────────────────────────── helpers ─────────────────────────────

// Deterministic random numbers, so every run produces the same school.
let rngState = 20261010;
function rand(): number {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
function gauss(): number {
  // Box-Muller
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`); // UTC midnight, as the app stores dates
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const atTime = (date: Date, h: number, m = 0) => new Date(date.getTime() + (h * 60 + m) * 60_000);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ───────────────────────────── calendar ─────────────────────────────

const YEAR = 2026;
const TERMS = [
  { type: "TERM_1", start: "2026-01-12", end: "2026-04-10" },
  { type: "TERM_2", start: "2026-05-04", end: "2026-08-07" },
  { type: "TERM_3", start: "2026-09-07", end: "2026-12-04" },
] as const;

// Zambian public holidays falling on school days in 2026 (observed dates).
const HOLIDAYS = new Set([
  "2026-03-09", // Women's Day (observed)
  "2026-03-12", // Youth Day
  "2026-04-03", // Good Friday
  "2026-04-06", // Easter Monday
  "2026-05-25", // Africa Day
  "2026-07-06", // Heroes' Day
  "2026-07-07", // Unity Day
  "2026-08-03", // Farmers' Day
  "2026-10-19", // National Day of Prayer (observed)
]);

const TODAY = d(isoDay(new Date()));

function schoolDays(startIso: string, endIso: string): Date[] {
  const days: Date[] = [];
  const end = d(endIso) < TODAY ? d(endIso) : TODAY;
  for (let t = d(startIso); t <= end; t = new Date(t.getTime() + 86_400_000)) {
    const dow = t.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (HOLIDAYS.has(isoDay(t))) continue;
    days.push(t);
  }
  return days;
}

// ───────────────────────────── people ─────────────────────────────

const MALE = ["Mwila", "Chanda", "Bwalya", "Musonda", "Kelvin", "Brian", "Joseph", "Daniel", "Emmanuel", "Moses", "Chileshe", "Mapalo", "Lubuto", "Thandiwe", "Kondwani", "Mphatso", "Chisomo", "Chikondi", "Taonga", "Isaac", "Samuel", "Patrick", "Victor", "Lazarus", "Kapembwa", "Nathan", "Elijah", "Chimwemwe", "Lwiza", "Jacob", "Peter", "Martin", "Yotam", "Kasonde", "Mutale", "Kabaso", "Malama", "Sipho", "Wezi", "Zondwayo"];
const FEMALE = ["Natasha", "Mercy", "Grace", "Agness", "Esther", "Ruth", "Febby", "Chipo", "Mwaka", "Bupe", "Chilufya", "Mutinta", "Namakau", "Thokozile", "Lusungu", "Tiyamike", "Mwenya", "Precious", "Lillian", "Purity", "Faith", "Hope", "Memory", "Charity", "Mapenzi", "Nchimunya", "Inonge", "Musonda", "Kasuba", "Towela", "Natasha", "Joyce", "Mirriam", "Doris", "Bertha", "Hazel", "Taonga", "Chisanga", "Mulenga", "Wanga"];
const SURNAMES = ["Banda", "Phiri", "Mwale", "Tembo", "Zulu", "Mulenga", "Chanda", "Bwalya", "Mwansa", "Daka", "Sakala", "Ngoma", "Kabwe", "Mumba", "Musonda", "Chilufya", "Kapembwa", "Nkhoma", "Mbewe", "Siame", "Simukonda", "Hamoonga", "Muleya", "Chirwa", "Lungu", "Mwape", "Kalaba", "Chola", "Katongo", "Sichone", "Nyirongo", "Kasonde", "Mutale", "Habeenzu", "Moonga", "Mweemba", "Haangala", "Chibuye", "Kunda", "Njobvu", "Silwamba", "Kaluba", "Mazimba", "Shawa", "Mvula"];
const OCCUPATIONS = ["Teacher", "Nurse", "Farmer", "Marketeer", "Civil servant", "Driver", "Accountant", "Mechanic", "Small business owner", "Police officer", "Tailor", "Electrician", "Bank teller", "Miner", "Carpenter", "Clinical officer", "Security guard", "Shop owner"];
const AREAS = ["Chilenje", "Kabulonga", "Matero", "Chelstone", "Kalingalinga", "Mtendere", "Woodlands", "Kabwata", "Libala", "Chawama", "Kaunda Square", "Avondale", "Emmasdale", "Olympia", "Northmead"];

let phoneCounter = 1000;
const fakePhone = () => `+26097${String(1000000 + phoneCounter++).slice(1)}`; // made-up demo numbers
const DOMAIN = "kaliweheights.example";
const PASSWORD = process.env.DEMO_SEED_PASSWORD || randomBytes(9).toString("base64url");
const DEMO_SCHOOL_ID = "school-demo-kaliwe";
const DEMO_SCHOOL_NAME = "Kaliwe Heights Secondary School";

// ───────────────────────────── curriculum ─────────────────────────────

const DEPARTMENTS = [
  { code: "MATHSCI", name: "Mathematics & Natural Sciences", description: "Mathematics, Biology, Chemistry and Physics" },
  { code: "LANG", name: "Languages", description: "English Language, Literature in English and Cinyanja" },
  { code: "SOCSCI", name: "Social Sciences", description: "Geography, History, Civic and Religious Education" },
  { code: "BUSTECH", name: "Business & Technology", description: "Computer Studies and Business Studies" },
] as const;

// difficulty: average % a typical student scores in this subject
const SUBJECTS = [
  { code: "ENG", name: "English Language", dept: "LANG", difficulty: 58 },
  { code: "LIT", name: "Literature in English", dept: "LANG", difficulty: 56 },
  { code: "CIN", name: "Cinyanja", dept: "LANG", difficulty: 64 },
  { code: "MATH", name: "Mathematics", dept: "MATHSCI", difficulty: 47 },
  { code: "BIO", name: "Biology", dept: "MATHSCI", difficulty: 53 },
  { code: "CHEM", name: "Chemistry", dept: "MATHSCI", difficulty: 48 },
  { code: "PHY", name: "Physics", dept: "MATHSCI", difficulty: 46 },
  { code: "GEO", name: "Geography", dept: "SOCSCI", difficulty: 55 },
  { code: "HIST", name: "History", dept: "SOCSCI", difficulty: 57 },
  { code: "CIV", name: "Civic Education", dept: "SOCSCI", difficulty: 61 },
  { code: "RE", name: "Religious Education", dept: "SOCSCI", difficulty: 63 },
  { code: "COMP", name: "Computer Studies", dept: "BUSTECH", difficulty: 59 },
  { code: "BUS", name: "Business Studies", dept: "BUSTECH", difficulty: 57 },
] as const;
type SubjectCode = (typeof SUBJECTS)[number]["code"];
// Demo codes that differ from the national catalogue (Phase 3b). Business Studies is an A-level
// subject nationally, so at O-level it stays a local subject (no link).
const DEMO_TO_CATALOGUE: Partial<Record<string, string>> = { CIN: "ZL", CIV: "CIVIC", COMP: "ICT", BUS: "" };

const FORM_CURRICULUM: Record<string, number> = { ENG: 6, MATH: 6, BIO: 4, CHEM: 3, PHY: 3, GEO: 3, HIST: 3, CIV: 3, RE: 2, COMP: 3, CIN: 3 };
const G10_CURRICULUM: Record<string, number> = { ENG: 6, MATH: 6, BIO: 4, CHEM: 4, PHY: 4, GEO: 3, CIV: 3, RE: 3, COMP: 3, BUS: 3 };
const G11_12_CURRICULUM: Record<string, number> = { ...G10_CURRICULUM, LIT: 3 };

const GRADES = [
  { level: "GRADE_1", name: "Grade 1", school: "PRIMARY" },
  { level: "GRADE_2", name: "Grade 2", school: "PRIMARY" },
  { level: "GRADE_3", name: "Grade 3", school: "PRIMARY" },
  { level: "GRADE_4", name: "Grade 4", school: "PRIMARY" },
  { level: "GRADE_5", name: "Grade 5", school: "PRIMARY" },
  { level: "GRADE_6", name: "Grade 6", school: "PRIMARY" },
  { level: "GRADE_7", name: "Grade 7", school: "PRIMARY" },
  { level: "GRADE_8", name: "Form 1", school: "SECONDARY" },
  { level: "GRADE_9", name: "Form 2", school: "SECONDARY" },
  { level: "GRADE_10", name: "Grade 10", school: "SECONDARY" },
  { level: "GRADE_11", name: "Grade 11", school: "SECONDARY" },
  { level: "GRADE_12", name: "Grade 12", school: "SECONDARY" },
] as const;

const CLASSES = [
  { grade: "GRADE_8", name: "A", curriculum: FORM_CURRICULUM, admitted: 2026, size: 40 },
  { grade: "GRADE_8", name: "B", curriculum: FORM_CURRICULUM, admitted: 2026, size: 38 },
  { grade: "GRADE_9", name: "A", curriculum: FORM_CURRICULUM, admitted: 2025, size: 39 },
  { grade: "GRADE_9", name: "B", curriculum: FORM_CURRICULUM, admitted: 2025, size: 37 },
  { grade: "GRADE_10", name: "A", curriculum: G10_CURRICULUM, admitted: 2026, size: 38 },
  { grade: "GRADE_10", name: "B", curriculum: G10_CURRICULUM, admitted: 2026, size: 36 },
  { grade: "GRADE_11", name: "A", curriculum: G11_12_CURRICULUM, admitted: 2025, size: 35 },
  { grade: "GRADE_12", name: "A", curriculum: G11_12_CURRICULUM, admitted: 2024, size: 34 },
] as const;

// Staff. `subjects[0]` is their main subject. maxLoad = teaching periods per week.
const LEADERSHIP = [
  // The school administrator works as CLERK (data entry); ADMIN is no longer a school role.
  { email: `admin@${DOMAIN}`, role: "CLERK", first: "Chipo", last: "Nkhoma", gender: "FEMALE", staff: "KHS-ADM-001", qual: "DEGREE", yrs: 11 },
  { email: `head@${DOMAIN}`, role: "HEAD_TEACHER", first: "Joseph", last: "Mulenga", gender: "MALE", staff: "KHS-HT-001", qual: "MASTERS", yrs: 24 },
  { email: `deputy@${DOMAIN}`, role: "DEPUTY_HEAD", first: "Ruth", last: "Tembo", gender: "FEMALE", staff: "KHS-DH-001", qual: "MASTERS", yrs: 19 },
] as const;

const TEACHERS = [
  { key: "pmwale", email: `hod.maths@${DOMAIN}`, first: "Peter", last: "Mwale", gender: "MALE", subjects: ["MATH"], hodOf: "MATHSCI", maxLoad: 18, qual: "MASTERS", yrs: 16 },
  { key: "ebanda", email: `teacher@${DOMAIN}`, first: "Esther", last: "Banda", gender: "FEMALE", subjects: ["MATH"], maxLoad: 26, qual: "DEGREE", yrs: 7 },
  { key: "bchanda", email: `brian.chanda@${DOMAIN}`, first: "Brian", last: "Chanda", gender: "MALE", subjects: ["MATH", "PHY"], maxLoad: 26, qual: "DEGREE", yrs: 5 },
  { key: "mkabwe", email: `moses.kabwe@${DOMAIN}`, first: "Moses", last: "Kabwe", gender: "MALE", subjects: ["PHY", "MATH"], maxLoad: 26, qual: "DIPLOMA", yrs: 9 },
  { key: "aphiri", email: `agness.phiri@${DOMAIN}`, first: "Agness", last: "Phiri", gender: "FEMALE", subjects: ["BIO", "CHEM"], maxLoad: 26, qual: "DEGREE", yrs: 12 },
  { key: "kzulu", email: `kelvin.zulu@${DOMAIN}`, first: "Kelvin", last: "Zulu", gender: "MALE", subjects: ["CHEM", "PHY"], maxLoad: 26, qual: "DEGREE", yrs: 6 },
  { key: "msakala", email: `mercy.sakala@${DOMAIN}`, first: "Mercy", last: "Sakala", gender: "FEMALE", subjects: ["BIO"], maxLoad: 26, qual: "DIPLOMA", yrs: 4 },
  { key: "gmumba", email: `hod.languages@${DOMAIN}`, first: "Grace", last: "Mumba", gender: "FEMALE", subjects: ["ENG", "LIT"], hodOf: "LANG", maxLoad: 18, qual: "MASTERS", yrs: 18 },
  { key: "dmusonda", email: `dennis.musonda@${DOMAIN}`, first: "Dennis", last: "Musonda", gender: "MALE", subjects: ["ENG", "LIT"], maxLoad: 26, qual: "DEGREE", yrs: 8 },
  { key: "lngoma", email: `lillian.ngoma@${DOMAIN}`, first: "Lillian", last: "Ngoma", gender: "FEMALE", subjects: ["ENG"], maxLoad: 26, qual: "DEGREE", yrs: 3 },
  { key: "cdaka", email: `chisomo.daka@${DOMAIN}`, first: "Chisomo", last: "Daka", gender: "MALE", subjects: ["CIN", "ENG"], maxLoad: 24, qual: "DIPLOMA", yrs: 10 },
  { key: "gmbewe", email: `hod.socialsciences@${DOMAIN}`, first: "Gift", last: "Mbewe", gender: "MALE", subjects: ["GEO"], hodOf: "SOCSCI", maxLoad: 18, qual: "MASTERS", yrs: 15 },
  { key: "nsiame", email: `natasha.siame@${DOMAIN}`, first: "Natasha", last: "Siame", gender: "FEMALE", subjects: ["HIST", "CIV"], maxLoad: 26, qual: "DEGREE", yrs: 6 },
  { key: "vhamoonga", email: `victor.hamoonga@${DOMAIN}`, first: "Victor", last: "Hamoonga", gender: "MALE", subjects: ["CIV", "GEO"], maxLoad: 26, qual: "DEGREE", yrs: 9 },
  { key: "fchilufya", email: `febby.chilufya@${DOMAIN}`, first: "Febby", last: "Chilufya", gender: "FEMALE", subjects: ["RE", "CIV"], maxLoad: 26, qual: "DIPLOMA", yrs: 13 },
  { key: "imuleya", email: `hod.business@${DOMAIN}`, first: "Isaac", last: "Muleya", gender: "MALE", subjects: ["COMP"], hodOf: "BUSTECH", maxLoad: 18, qual: "MASTERS", yrs: 14 },
  { key: "psimukonda", email: `precious.simukonda@${DOMAIN}`, first: "Precious", last: "Simukonda", gender: "FEMALE", subjects: ["COMP", "BUS"], maxLoad: 26, qual: "DEGREE", yrs: 5 },
  { key: "mkapembwa", email: `mutale.kapembwa@${DOMAIN}`, first: "Mutale", last: "Kapembwa", gender: "MALE", subjects: ["BUS", "COMP"], maxLoad: 26, qual: "DEGREE", yrs: 7 },
] as const;

// Class teachers (form tutors), by class label.
const CLASS_TEACHERS: Record<string, string> = {
  "GRADE_8-A": "lngoma", "GRADE_8-B": "msakala", "GRADE_9-A": "ebanda", "GRADE_9-B": "cdaka",
  "GRADE_10-A": "bchanda", "GRADE_10-B": "nsiame", "GRADE_11-A": "kzulu", "GRADE_12-A": "aphiri",
};

// Term 3 lesson topics (used for lesson logs).
const TOPICS: Record<SubjectCode, string[]> = {
  ENG: ["Summary writing", "Comprehension: inference questions", "Composition: argumentative essays", "Reported speech", "Formal letters", "Vocabulary in context", "Punctuation and sentence structure", "Directed writing: reports", "Oral presentation skills", "Exam technique: Paper 1"],
  LIT: ["Poetry: imagery and tone", "Set novel: character analysis", "Drama: themes and conflict", "Context questions practice", "Essay planning for literature", "Comparing two poems", "Set play: Act 2 review", "Narrative voice and point of view"],
  CIN: ["Kalembedwe ka makalata", "Miyambi ndi mafanizo", "Kumvetsetsa ndime", "Galamala: maverebu", "Nthano za makolo", "Kulemba nkhani", "Ndakatulo", "Mau ofanana ndi otsutsana"],
  MATH: ["Quadratic equations", "Simultaneous equations", "Trigonometry: sine and cosine rules", "Vectors", "Matrices and transformations", "Statistics: mean, median, mode", "Probability", "Mensuration: surface area and volume", "Linear programming", "Revision: past paper practice"],
  BIO: ["Nutrition in humans", "Transport in plants", "Respiration", "Excretion and the kidney", "Coordination and response", "Reproduction in plants", "Ecology: food chains and webs", "Genetics and inheritance", "Practical: food tests"],
  CHEM: ["Atomic structure", "Chemical bonding", "Mole concept", "Acids, bases and salts", "Rates of reaction", "Electrolysis", "Organic chemistry: alkanes and alkenes", "Practical: titration", "Periodic table trends"],
  PHY: ["Measurements and units", "Motion: speed and acceleration", "Forces and Newton's laws", "Work, energy and power", "Pressure", "Thermal physics", "Waves and sound", "Electricity: circuits", "Magnetism"],
  GEO: ["Map reading: scale and grid references", "Weather and climate of Zambia", "Rivers and drainage", "Population and settlement", "Agriculture in Zambia", "Mining on the Copperbelt", "Tourism", "Field work techniques"],
  HIST: ["Pre-colonial states of Zambia", "The slave trade", "Colonial rule in Northern Rhodesia", "The road to independence", "Federation of Rhodesia and Nyasaland", "Post-independence Zambia", "World War I and Africa", "Source analysis skills"],
  CIV: ["The Constitution of Zambia", "Human rights and responsibilities", "Governance and democracy", "Elections and the electoral process", "Citizenship", "Corruption and its effects", "Gender and development", "The rule of law"],
  RE: ["The Ten Commandments", "Christian values in daily life", "Respect and tolerance", "Marriage and family life", "Leadership and service", "Islam: the Five Pillars", "Hinduism: key beliefs", "Moral decision making"],
  COMP: ["Computer hardware components", "Operating systems", "Word processing", "Spreadsheets: formulas and functions", "Databases: tables and queries", "Networks and the internet", "Introduction to programming", "Algorithms and flowcharts", "Data security and privacy"],
  BUS: ["Types of business ownership", "Entrepreneurship", "Marketing basics", "Book-keeping: the ledger", "Banking services", "Trade and commerce", "Insurance", "Business communication"],
};

const CLASS_TEACHER_REMARKS = {
  excellent: ["Outstanding performance. Keep it up!", "An excellent term. A model student.", "Exceptional work across all subjects."],
  good: ["Good work this term. Aim even higher.", "A consistent and hard-working learner.", "Very good effort. Keep improving."],
  average: ["Fair performance. More effort is needed in weaker subjects.", "Can do better with more consistent revision.", "Satisfactory. Work on time management."],
  weak: ["Needs to put in much more effort.", "Must attend remedial classes and revise regularly.", "Performance below expectation. Parents to see the class teacher."],
};
const HEAD_REMARKS = {
  excellent: "Excellent results. Congratulations.",
  good: "Good results. Keep working hard.",
  average: "Fair. Greater effort required next term.",
  weak: "Below average. Serious improvement needed.",
};

const DOUBLE_PERIOD_SUBJECTS: SubjectCode[] = ["MATH", "ENG", "BIO", "CHEM", "PHY"];

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const { systemPrisma } = await import("@/lib/db/prisma");
  const { runWithTenant } = await import("@/lib/db/tenant");

  // Local databases only (same rule as prisma/seed.ts).
  const dbHost = new URL(process.env.DATABASE_URL ?? "postgresql://localhost").hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(dbHost) && process.env.SEED_ALLOW_REMOTE !== "true") {
    throw new Error(`Refusing to add demo data to a database on "${dbHost}". Demo data is for local databases only.`);
  }

  if (await systemPrisma.school.findUnique({ where: { id: DEMO_SCHOOL_ID } })) {
    throw new Error(
      `The demo school "${DEMO_SCHOOL_NAME}" is already in this database.\n` +
        "To start it again from scratch, use a fresh database (run the migrations, then this script)."
    );
  }

  // The demo school is its own school (district not yet assigned, like every school for now).
  await systemPrisma.school.create({
    data: { id: DEMO_SCHOOL_ID, name: DEMO_SCHOOL_NAME, category: "PUBLIC", districtOfficeId: "office-district-unassigned" },
  });

  // Everything below runs inside the demo school, exactly like a request from its head teacher.
  await runWithTenant({ schoolId: DEMO_SCHOOL_ID, userId: null }, () => seedDemoSchool());
  await systemPrisma.$disconnect();
}

async function seedDemoSchool() {
  const { default: prisma, systemPrisma } = await import("@/lib/db/prisma");

  console.log(`🏫 Seeding demo school: ${DEMO_SCHOOL_NAME} (fictional)\n`);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Role permissions (national; same mapping as scripts/seed-permissions.js). Head teacher and
  //    deputy share the leaders' permissions in the app, whatever is listed here.
  const ALL_PERMS = ["CREATE_STUDENT", "READ_STUDENT", "UPDATE_STUDENT", "DELETE_STUDENT", "CREATE_CLASS", "READ_CLASS", "UPDATE_CLASS", "DELETE_CLASS", "CREATE_ASSESSMENT", "READ_ASSESSMENT", "UPDATE_ASSESSMENT", "DELETE_ASSESSMENT", "ENTER_RESULTS", "CREATE_TEACHER", "READ_TEACHER", "UPDATE_TEACHER", "DELETE_TEACHER", "VIEW_REPORTS", "GENERATE_REPORTS", "MANAGE_ROLES", "MANAGE_PERMISSIONS", "MANAGE_ACADEMIC_YEAR", "MANAGE_TERMS", "MANAGE_TIMETABLE", "APPROVE_PROMOTION", "MARK_ATTENDANCE", "VIEW_ATTENDANCE", "SEND_SMS", "VIEW_SMS_LOGS"];
  const ROLE_PERMS: Record<string, string[]> = {
    ADMIN: ALL_PERMS,
    HEAD_TEACHER: ["CREATE_STUDENT", "READ_STUDENT", "UPDATE_STUDENT", "DELETE_STUDENT", "CREATE_CLASS", "READ_CLASS", "UPDATE_CLASS", "DELETE_CLASS", "CREATE_ASSESSMENT", "READ_ASSESSMENT", "UPDATE_ASSESSMENT", "DELETE_ASSESSMENT", "ENTER_RESULTS", "CREATE_TEACHER", "READ_TEACHER", "UPDATE_TEACHER", "VIEW_REPORTS", "GENERATE_REPORTS", "MANAGE_ACADEMIC_YEAR", "MANAGE_TERMS", "MANAGE_TIMETABLE", "APPROVE_PROMOTION", "MARK_ATTENDANCE", "VIEW_ATTENDANCE"],
    DEPUTY_HEAD: ["CREATE_STUDENT", "READ_STUDENT", "UPDATE_STUDENT", "CREATE_CLASS", "READ_CLASS", "UPDATE_CLASS", "DELETE_CLASS", "CREATE_ASSESSMENT", "READ_ASSESSMENT", "UPDATE_ASSESSMENT", "DELETE_ASSESSMENT", "ENTER_RESULTS", "READ_TEACHER", "UPDATE_TEACHER", "VIEW_REPORTS", "GENERATE_REPORTS", "MANAGE_ACADEMIC_YEAR", "MANAGE_TERMS", "MANAGE_TIMETABLE", "MARK_ATTENDANCE", "VIEW_ATTENDANCE"],
    TEACHER: ["READ_STUDENT", "UPDATE_STUDENT", "READ_CLASS", "CREATE_ASSESSMENT", "READ_ASSESSMENT", "UPDATE_ASSESSMENT", "DELETE_ASSESSMENT", "ENTER_RESULTS", "READ_TEACHER", "VIEW_REPORTS", "GENERATE_REPORTS", "MARK_ATTENDANCE", "VIEW_ATTENDANCE"],
    CLERK: ["CREATE_STUDENT", "READ_STUDENT", "UPDATE_STUDENT", "CREATE_CLASS", "READ_CLASS", "UPDATE_CLASS", "READ_ASSESSMENT", "CREATE_TEACHER", "READ_TEACHER", "UPDATE_TEACHER", "VIEW_REPORTS", "VIEW_ATTENDANCE"],
  };
  await prisma.rolePermission.createMany({
    data: Object.entries(ROLE_PERMS).flatMap(([role, perms]) => perms.map((permission) => ({ role: role as Role, permission: permission as Permission }))),
    skipDuplicates: true,
  });

  // ── School info settings
  const schoolInfo: Record<string, string> = {
    name: "Kaliwe Heights Secondary School",
    motto: "Knowledge, Integrity, Service",
    address: "Plot 1147, Kaliwe Road",
    city: "Lusaka",
    province: "Lusaka Province",
    postalCode: "10101",
    phone: "+260 211 000 000",
    email: `info@${DOMAIN}`,
    website: "",
    smsPhone: "",
    principalName: "Mr. Joseph Mulenga",
    foundedYear: "1998",
    studentCapacity: "450",
    schoolType: "Secondary",
    registrationNumber: "DEMO-0001",
    logoFilename: "demo-school-logo.png",
  };
  for (const [key, value] of Object.entries(schoolInfo)) {
    await prisma.systemSettings.upsert({
      where: { schoolId_key: { schoolId: DEMO_SCHOOL_ID, key } },
      update: { value, category: "school_info" },
      create: { key, value, category: "school_info" },
    });
  }

  // ── Year levels: the demo school's own list (Phase 3b). It's mid-changeover: Forms 1–2 on the
  //    2023 curriculum, Grades 10–12 finishing the 2013 one, primary grades on the 2013 structure.
  const gradeIds: Record<string, string> = {};
  for (const [i, g] of GRADES.entries()) {
    const isForm = g.name.startsWith("Form");
    const stage = stageFromLegacyLevel(isForm ? null : g.level, g.name) ?? "O_LEVEL";
    const exam =
      g.level === "GRADE_7" ? "PSLE_LEGACY" : g.level === "GRADE_12" ? "SC_O_LEGACY" : "NONE";
    const row = await prisma.grade.create({
      data: {
        level: isForm ? null : (g.level as GradeLevel),
        name: g.name,
        shortName: isForm ? g.name.replace("Form ", "F") : g.name.replace("Grade ", "G"),
        stage,
        curriculum: isForm ? "CBC_2023" : "LEGACY_2013",
        exam,
        schoolLevel: g.school as SchoolLevel,
        sequence: i + 1,
      },
    });
    gradeIds[g.level] = row.id;
  }
  for (let i = 0; i < GRADES.length - 1; i++) {
    await prisma.grade.update({ where: { id: gradeIds[GRADES[i].level] }, data: { nextGradeId: gradeIds[GRADES[i + 1].level] } });
  }

  // ── Academic year & terms
  const year = await prisma.academicYear.create({
    data: { year: YEAR, startDate: d(TERMS[0].start), endDate: d(TERMS[2].end), isActive: true },
  });
  const termIds: Record<string, string> = {};
  for (const t of TERMS) {
    const row = await prisma.term.create({
      data: { academicYearId: year.id, termType: t.type as TermType, startDate: d(t.start), endDate: d(t.end), isActive: t.type === "TERM_3" },
    });
    termIds[t.type] = row.id;
  }
  console.log("✅ Academic year 2026 with 3 terms (Term 3 active)");

  // ── Departments & subjects
  const deptIds: Record<string, string> = {};
  for (const dep of DEPARTMENTS) {
    const row = await prisma.department.create({ data: { code: dep.code, name: dep.name, description: dep.description } });
    deptIds[dep.code] = row.id;
  }
  const subjectIds: Record<string, string> = {};
  for (const s of SUBJECTS) {
    const catalogueCode = DEMO_TO_CATALOGUE[s.code] ?? s.code;
    const entry = await prisma.catalogueSubject.findUnique({ where: { code: catalogueCode }, select: { id: true } });
    const row = await prisma.subject.create({
      data: { code: s.code, name: s.name, departmentId: deptIds[s.dept], catalogueSubjectId: entry?.id ?? null },
    });
    subjectIds[s.code] = row.id;
  }

  // ── Staff accounts
  const makeDob = (yrs: number) => d(`${1998 - yrs - randInt(0, 6)}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`);
  const userIdByKey: Record<string, string> = {};
  const profileIdByKey: Record<string, string> = {};
  const staffForPrompt: string[] = [];

  async function createStaff(key: string, email: string, role: string, first: string, last: string, gender: string, staffNumber: string, qual: string, yrs: number) {
    const user = await prisma.user.create({
      data: { email, passwordHash, role: role as Role, isActive: true, hasDefaultPassword: false, lastLogin: atTime(TODAY, 7, randInt(0, 50)) },
    });
    // Their role at the demo school. The membership comes first: the school can only see the
    // profiles of its own members.
    await systemPrisma.schoolMembership.create({ data: { userId: user.id, schoolId: DEMO_SCHOOL_ID, role: role as Role, status: "ACTIVE" } });
    const profile = await prisma.teacherProfile.create({
      data: {
        userId: user.id, staffNumber, firstName: first, lastName: last, dateOfBirth: makeDob(yrs), gender: gender as Gender,
        phone: fakePhone(), address: `${pick(AREAS)}, Lusaka`, qualification: qual as QualificationLevel, yearsExperience: yrs,
        hireDate: d(`${Math.max(2005, YEAR - Math.min(yrs, 12))}-01-10`),
      },
    });
    userIdByKey[key] = user.id;
    profileIdByKey[key] = profile.id;
    staffForPrompt.push(`${email}`);
  }

  for (const l of LEADERSHIP) {
    // Keyed by job: "ADMIN" is the school administrator (role CLERK), the others by their role.
    const key = l.email.startsWith("admin@") ? "ADMIN" : l.role;
    await createStaff(key, l.email, l.role, l.first, l.last, l.gender, l.staff, l.qual, l.yrs);
  }
  for (const [i, t] of TEACHERS.entries()) {
    await createStaff(t.key, t.email, "TEACHER", t.first, t.last, t.gender, `KHS-TCH-${String(i + 1).padStart(3, "0")}`, t.qual, t.yrs);
    // subjects: first = PRIMARY, second = SECONDARY
    for (const [j, code] of t.subjects.entries()) {
      await prisma.teacherSubject.create({ data: { teacherId: profileIdByKey[t.key], subjectId: subjectIds[code], role: j === 0 ? "PRIMARY" : "SECONDARY" } });
    }
    const dept = SUBJECTS.find((s) => s.code === t.subjects[0])!.dept;
    await prisma.teacherDepartment.create({ data: { teacherId: profileIdByKey[t.key], departmentId: deptIds[dept], isPrimary: true } });
    if ("hodOf" in t && t.hodOf) {
      await prisma.department.update({ where: { id: deptIds[t.hodOf] }, data: { hodTeacherId: profileIdByKey[t.key] } });
      await prisma.userPermission.createMany({
        data: ["UPDATE_TEACHER", "CREATE_ASSESSMENT", "UPDATE_ASSESSMENT", "VIEW_REPORTS"].map((p) => ({
          userId: userIdByKey[t.key], permission: p as Permission, grantedById: profileIdByKey["ADMIN"], reason: `HOD position: ${t.hodOf}`,
        })),
      });
    }
  }
  console.log(`✅ ${LEADERSHIP.length + TEACHERS.length} staff accounts, 4 departments with HODs, ${SUBJECTS.length} subjects`);

  // ── Rooms
  const roomRows = [
    ...CLASSES.map((c, i) => ({ name: `Classroom ${i + 1}`, code: `CR${i + 1}`, type: "REGULAR_CLASSROOM", capacity: 45, building: i < 4 ? "Block A" : "Block B" })),
    { name: "Science Laboratory", code: "LAB1", type: "SCIENCE_LAB", capacity: 40, building: "Science Block" },
    { name: "Computer Laboratory", code: "ICT1", type: "COMPUTER_LAB", capacity: 40, building: "Science Block" },
    { name: "Library", code: "LIB", type: "LIBRARY", capacity: 60, building: "Main Block" },
  ];
  await prisma.room.createMany({ data: roomRows.map((r) => ({ ...r, type: r.type as RoomType })) });

  // ── Classes, curriculum, assignments
  type ClassInfo = { id: string; label: string; gradeLevel: string; gradeName: string; name: string; subjects: { code: SubjectCode; classSubjectId: string; periods: number; teacherKey: string }[]; classTeacherKey: string; admitted: number; size: number };
  const classes: ClassInfo[] = [];
  const load: Record<string, number> = Object.fromEntries(TEACHERS.map((t) => [t.key, 0]));

  // Grade-level curriculum (GradeSubject + period requirements)
  for (const g of ["GRADE_8", "GRADE_9", "GRADE_10", "GRADE_11", "GRADE_12"]) {
    const cur = CLASSES.find((c) => c.grade === g)!.curriculum;
    for (const [code, periods] of Object.entries(cur)) {
      await prisma.gradeSubject.create({ data: { gradeId: gradeIds[g], subjectId: subjectIds[code], isCore: ["ENG", "MATH"].includes(code) } });
      await prisma.subjectPeriodRequirement.create({ data: { gradeId: gradeIds[g], subjectId: subjectIds[code], periodsPerWeek: periods } });
    }
  }

  for (const c of CLASSES) {
    const gradeName = GRADES.find((g) => g.level === c.grade)!.name;
    const cls = await prisma.class.create({ data: { name: c.name, gradeId: gradeIds[c.grade], capacity: 45, currentEnrolled: c.size } });
    const info: ClassInfo = { id: cls.id, label: `${gradeName} ${c.name}`, gradeLevel: c.grade, gradeName, name: c.name, subjects: [], classTeacherKey: CLASS_TEACHERS[`${c.grade}-${c.name}`], admitted: c.admitted, size: c.size };
    classes.push(info);
  }

  // Assign teachers: biggest subjects first, least-loaded qualified teacher wins.
  const demand: { cls: ClassInfo; code: SubjectCode; periods: number }[] = [];
  for (const cls of classes) {
    const cur = CLASSES.find((c) => c.grade === cls.gradeLevel && c.name === cls.name)!.curriculum;
    for (const [code, periods] of Object.entries(cur)) demand.push({ cls, code: code as SubjectCode, periods });
  }
  demand.sort((a, b) => b.periods - a.periods || a.code.localeCompare(b.code));
  for (const item of demand) {
    const candidates = TEACHERS.filter((t) => (t.subjects as readonly string[]).includes(item.code) && load[t.key] + item.periods <= t.maxLoad)
      .sort((a, b) => {
        // lowest relative load wins; teachers for whom this is the main subject get a head start
        const score = (t: (typeof TEACHERS)[number]) => load[t.key] / t.maxLoad - (t.subjects[0] === item.code ? 0.6 : 0);
        return score(a) - score(b);
      });
    if (candidates.length === 0) throw new Error(`No teacher has capacity for ${item.code} in ${item.cls.label}`);
    const teacher = candidates[0];
    load[teacher.key] += item.periods;
    const cs = await prisma.classSubject.create({ data: { classId: item.cls.id, subjectId: subjectIds[item.code], periodsPerWeek: item.periods, isCore: ["ENG", "MATH"].includes(item.code) } });
    await prisma.subjectTeacherAssignment.create({
      data: { teacherId: profileIdByKey[teacher.key], subjectId: subjectIds[item.code], classId: item.cls.id, academicYearId: year.id, classSubjectId: cs.id, startedAt: d(TERMS[0].start) },
    });
    item.cls.subjects.push({ code: item.code, classSubjectId: cs.id, periods: item.periods, teacherKey: teacher.key });
  }
  for (const cls of classes) {
    await prisma.classTeacherAssignment.create({ data: { teacherId: profileIdByKey[cls.classTeacherKey], classId: cls.id, academicYearId: year.id, startedAt: d(TERMS[0].start) } });
  }
  console.log(`✅ ${classes.length} classes with curriculum, subject teachers and class teachers`);
  console.log("   Teaching loads (periods/week): " + TEACHERS.map((t) => `${t.first} ${t.last} ${load[t.key]}`).join(", "));

  // ── Students & guardians
  type StudentInfo = { id: string; classId: string; ability: number; subjectSkill: Record<string, number>; trend: number; attendRate: number; guardianId: string; phone: string; name: string };
  const students: StudentInfo[] = [];
  const studentsByClass: Record<string, StudentInfo[]> = {};
  const seq: Record<number, number> = {};
  type GuardianRef = { guardianId: string; phone: string; last: string; relationship: ParentRelationship };
  const siblingPool: GuardianRef[] = [];

  for (const cls of classes) {
    studentsByClass[cls.id] = [];
    const classEffect = gauss() * 2.5;
    const ageBase = { GRADE_8: 13, GRADE_9: 14, GRADE_10: 15, GRADE_11: 16, GRADE_12: 17 }[cls.gradeLevel as "GRADE_8"]!;
    for (let i = 0; i < cls.size; i++) {
      const female = chance(0.51);
      const first = pick(female ? FEMALE : MALE);
      const middle = chance(0.3) ? pick(female ? FEMALE : MALE) : null;

      // ~8% siblings share an existing guardian
      let guardian: GuardianRef;
      if (siblingPool.length > 20 && chance(0.08)) {
        guardian = pick(siblingPool);
      } else {
        const gLast = pick(SURNAMES);
        const phone = fakePhone();
        const gFemale = chance(0.6);
        const g = await prisma.guardian.create({
          data: {
            firstName: pick(gFemale ? FEMALE : MALE), lastName: gLast, phone,
            email: chance(0.35) ? `parent${phoneCounter}@mail.example` : null,
            address: `House ${randInt(1, 999)}, ${pick(AREAS)}, Lusaka`, occupation: pick(OCCUPATIONS),
          },
        });
        const relationship: ParentRelationship = gFemale
          ? (chance(0.85) ? "MOTHER" : pick(["GUARDIAN", "GRANDPARENT"] as const))
          : (chance(0.85) ? "FATHER" : pick(["GUARDIAN", "SIBLING"] as const));
        guardian = { guardianId: g.id, phone, last: gLast, relationship };
        siblingPool.push(guardian);
      }
      const last = chance(0.85) ? guardian.last : pick(SURNAMES);

      seq[cls.admitted] = (seq[cls.admitted] ?? 0) + 1;
      const vulnRoll = rand();
      const vulnerability: VulnerabilityStatus = vulnRoll < 0.06 ? "ORPHAN" : vulnRoll < 0.09 ? "VULNERABLE_CHILD" : vulnRoll < 0.11 ? "SPECIAL_NEEDS" : "NOT_VULNERABLE";
      const student = await prisma.student.create({
        data: {
          studentNumber: `STU-${cls.admitted}-${String(seq[cls.admitted]).padStart(4, "0")}`,
          firstName: first, middleName: middle, lastName: last,
          dateOfBirth: d(`${YEAR - ageBase - randInt(0, 1)}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`),
          gender: female ? "FEMALE" : "MALE",
          admissionDate: d(`${cls.admitted}-01-${String(randInt(12, 20)).padStart(2, "0")}`),
          address: `${pick(AREAS)}, Lusaka`,
          medicalInfo: chance(0.05) ? pick(["Asthmatic, carries an inhaler", "Wears spectacles", "Allergic to penicillin"]) : null,
          vulnerability,
          orphanType: vulnerability === "ORPHAN" ? (chance(0.7) ? "SINGLE_ORPHAN" : "DOUBLE_ORPHAN") : null,
          deceasedParent: vulnerability === "ORPHAN" ? (chance(0.6) ? "FATHER" : "MOTHER") : null,
        },
      });
      await prisma.studentGuardian.create({ data: { studentId: student.id, guardianId: guardian.guardianId, relationship: guardian.relationship, isPrimary: true } });
      await prisma.studentClassEnrollment.create({ data: { studentId: student.id, classId: cls.id, academicYearId: year.id, enrollmentDate: d(TERMS[0].start) } });

      const ability = gauss() + classEffect / 10;
      const subjectSkill: Record<string, number> = {};
      for (const s of SUBJECTS) subjectSkill[s.code] = gauss();
      const attendRate = chance(0.08) ? 0.72 + rand() * 0.12 : 0.9 + rand() * 0.09;
      const info: StudentInfo = { id: student.id, classId: cls.id, ability, subjectSkill, trend: gauss() * 2, attendRate, guardianId: guardian.guardianId, phone: guardian.phone, name: `${first} ${last}` };
      students.push(info);
      studentsByClass[cls.id].push(info);
    }
  }
  console.log(`✅ ${students.length} students with guardians and enrolments`);

  // ── Daily attendance registers
  const attendanceRows: Prisma.AttendanceRecordCreateManyInput[] = [];
  const absencesByDay: Record<string, StudentInfo[]> = {};
  for (const t of TERMS) {
    const days = schoolDays(t.start, t.end);
    for (const cls of classes) {
      for (const day of days) {
        for (const s of studentsByClass[cls.id]) {
          const r = rand();
          let status: AttendanceStatus = "PRESENT";
          if (r > s.attendRate) status = chance(0.2) ? "EXCUSED" : "ABSENT";
          else if (chance(0.03)) status = "LATE";
          attendanceRows.push({
            studentId: s.id, classId: cls.id, termId: termIds[t.type], date: day, status,
            remarks: status === "EXCUSED" ? pick(["Sick - note from clinic", "Family function", "Hospital appointment"]) : status === "LATE" ? "Arrived after assembly" : null,
            markedById: profileIdByKey[cls.classTeacherKey], createdAt: atTime(day, 7, 40),
          });
          if (status === "ABSENT" && t.type === "TERM_3") (absencesByDay[isoDay(day)] ??= []).push(s);
        }
      }
    }
  }
  for (const part of chunk(attendanceRows, 5000)) await prisma.attendanceRecord.createMany({ data: part });
  console.log(`✅ ${attendanceRows.length.toLocaleString()} daily attendance marks`);

  // ── Assessment windows & assessments with results
  const WINDOWS: Record<string, Record<string, [string, string]>> = {
    TERM_1: { CAT: ["2026-02-09", "2026-02-20"], MID: ["2026-03-02", "2026-03-13"], EOT: ["2026-03-23", "2026-04-08"] },
    TERM_2: { CAT: ["2026-05-25", "2026-06-05"], MID: ["2026-06-15", "2026-06-26"], EOT: ["2026-07-20", "2026-08-05"] },
    TERM_3: { CAT: ["2026-09-21", "2026-10-02"], MID: ["2026-10-05", "2026-10-16"], EOT: ["2026-11-16", "2026-11-27"] },
  };
  const EXAM_NAMES = { CAT: "Continuous Assessment Test", MID: "Mid-Term Test", EOT: "End of Term Examination" } as const;
  const TOTALS = { CAT: 50, MID: 100, EOT: 100 } as const;
  const TERM_SHIFT = { TERM_1: -1.5, TERM_2: 0, TERM_3: 2 } as const; // school improving through the year
  const termNumber = (tt: string) => tt.slice(-1);

  for (const t of TERMS) {
    for (const ex of ["CAT", "MID", "EOT"] as const) {
      const [opens, closes] = WINDOWS[t.type][ex];
      await prisma.assessmentWindow.create({
        data: { termId: termIds[t.type], examType: ex as ExamType, opensAt: d(opens), closesAt: atTime(d(closes), 23, 59), createdBy: userIdByKey["ADMIN"] },
      });
    }
  }

  // Term 3 Mid-term: how far along each class-subject is with entering marks.
  type Progress = { status: "COMPLETED" | "PUBLISHED"; fraction: number };
  const midProgress = (): Progress => {
    const r = rand();
    if (r < 0.35) return { status: "COMPLETED", fraction: 1 };
    if (r < 0.75) return { status: "PUBLISHED", fraction: 0.3 + rand() * 0.6 };
    return { status: "PUBLISHED", fraction: 0 };
  };
  const pendingMidByTeacher: Record<string, string[]> = {};

  let assessmentCount = 0;
  let resultCount = 0;
  const resultRows: Prisma.StudentAssessmentResultCreateManyInput[] = [];
  function eczGrade(pct: number): ECZGrade {
    // Senior / Form scale (lib/grading/ecz-grading-system.ts SENIOR_GRADING)
    if (pct >= 75) return "GRADE_1";
    if (pct >= 70) return "GRADE_2";
    if (pct >= 65) return "GRADE_3";
    if (pct >= 60) return "GRADE_4";
    if (pct >= 55) return "GRADE_5";
    if (pct >= 50) return "GRADE_6";
    if (pct >= 45) return "GRADE_7";
    if (pct >= 40) return "GRADE_8";
    return "GRADE_9";
  }

  for (const t of TERMS) {
    for (const ex of ["CAT", "MID", "EOT"] as const) {
      const [opens, closes] = WINDOWS[t.type][ex];
      const windowOpen = d(opens);
      const windowClose = atTime(d(closes), 23, 59);
      const midpoint = new Date((windowOpen.getTime() + d(closes).getTime()) / 2);
      const examDate = midpoint < TODAY ? midpoint : TODAY;
      const inProgress = windowOpen <= TODAY && TODAY <= windowClose; // marks still being entered
      if (windowOpen > TODAY) {
        // Not written yet: a few teachers have prepared drafts already.
        for (const cls of classes) for (const s of cls.subjects) {
          if (!chance(0.2)) continue;
          await prisma.assessment.create({
            data: { title: `Term ${termNumber(t.type)} ${EXAM_NAMES[ex]} - ${SUBJECTS.find((x) => x.code === s.code)!.name}`, subjectId: subjectIds[s.code], classId: cls.id, termId: termIds[t.type], examType: ex, totalMarks: TOTALS[ex], passMark: 40, weight: ex === "CAT" ? 0.2 : ex === "MID" ? 0.3 : 0.5, assessmentDate: d(opens), status: "DRAFT", createdAt: atTime(TODAY, 9) },
          });
          assessmentCount++;
        }
        continue;
      }

      for (const cls of classes) {
        for (const s of cls.subjects) {
          const subj = SUBJECTS.find((x) => x.code === s.code)!;
          let status: AssessmentStatus = "COMPLETED";
          let fraction = 1;
          if (inProgress) {
            const p = midProgress();
            status = p.status;
            fraction = p.fraction;
            if (status !== "COMPLETED") (pendingMidByTeacher[s.teacherKey] ??= []).push(`${cls.label} ${subj.name}`);
          }
          let examDay = new Date(examDate.getTime() + randInt(-3, 0) * 86_400_000);
          if (examDay < windowOpen) examDay = windowOpen;
          const a = await prisma.assessment.create({
            data: {
              title: `Term ${termNumber(t.type)} ${EXAM_NAMES[ex]} - ${subj.name}`,
              description: `${cls.label} ${subj.name} ${EXAM_NAMES[ex].toLowerCase()}`,
              subjectId: subjectIds[s.code], classId: cls.id, termId: termIds[t.type], examType: ex, totalMarks: TOTALS[ex], passMark: 40,
              weight: ex === "CAT" ? 0.2 : ex === "MID" ? 0.3 : 0.5, assessmentDate: examDay, status,
              createdAt: new Date(examDay.getTime() - 7 * 86_400_000),
            },
          });
          assessmentCount++;

          const classList = studentsByClass[cls.id];
          const enterCount = Math.round(classList.length * fraction);
          for (const st of classList.slice(0, enterCount)) {
            const absent = chance(0.015);
            const examPenalty = ex === "EOT" ? -2 : ex === "CAT" ? 2 : 0;
            const pctRaw = subj.difficulty + 13 * st.ability + 6 * st.subjectSkill[s.code] + TERM_SHIFT[t.type] + st.trend * (Number(termNumber(t.type)) - 2) + examPenalty + gauss() * 7;
            const pct = clamp(pctRaw, 4, 98);
            const marks = absent ? 0 : Math.round((pct / 100) * TOTALS[ex] * 2) / 2;
            const gradePct = Math.round((marks / TOTALS[ex]) * 100);
            resultRows.push({
              studentId: st.id, assessmentId: a.id, subjectId: subjectIds[s.code], marksObtained: marks, isAbsent: absent,
              grade: absent ? null : eczGrade(gradePct),
              remarks: absent ? "Absent" : null,
              createdAt: (() => { const c = atTime(new Date(examDay.getTime() + randInt(1, 5) * 86_400_000), randInt(14, 20), randInt(0, 59)); return c > new Date() ? new Date() : c; })(),
            });
          }
        }
      }
    }
  }
  for (const part of chunk(resultRows, 5000)) await prisma.studentAssessmentResult.createMany({ data: part });
  resultCount = resultRows.length;
  console.log(`✅ ${assessmentCount} assessments, ${resultCount.toLocaleString()} marks entered (Term 3 mid-terms partly entered)`);

  // ── Timetable configuration + generation (uses the app's own solver)
  await prisma.timetableConfiguration.create({
    data: {
      academicYearId: year.id, termId: termIds["TERM_3"], schoolStartTime: "07:30", periodDuration: 40,
      breakStartPeriod: 6, breakDuration: 20, periodsBeforeBreak: 5, periodsAfterBreak: 4, totalPeriods: 9,
      // Maths & English (6 periods) need one double a week; sciences get a double for practicals.
      doublePeriodConfigs: DOUBLE_PERIOD_SUBJECTS.map((code) => ({ subjectId: subjectIds[code], requiresDoublePeriod: true, allowedDays: [], preferTimeOfDay: "ANY" })),
    },
  });
  const { timetableService } = await import("@/features/timetables/timetable.service");
  // The app's own services, acting as the head teacher (a school leader).
  const adminCtx = { userId: userIdByKey["HEAD_TEACHER"], role: "HEAD_TEACHER" as Role, teacherProfileId: profileIdByKey["HEAD_TEACHER"] };
  const gen = await timetableService.generateTimetable(year.id, adminCtx);
  console.log(`✅ Timetable generated: ${gen.slotsGenerated} lessons placed, ${gen.conflicts.length} conflicts (${gen.stats.successRate}% of assignments)`);

  // ── Lesson logs for Term 3 so far
  const slots = await prisma.timetableSlot.findMany({ where: { academicYearId: year.id }, include: { subject: true } });
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const topicIndex: Record<string, number> = {};
  const lessonRows: Prisma.LessonLogCreateManyInput[] = [];
  for (const day of schoolDays(TERMS[2].start, TERMS[2].end)) {
    const dow = dayNames[day.getUTCDay()];
    for (const slot of slots.filter((s) => s.dayOfWeek === dow)) {
      if (!chance(0.86)) continue;
      const code = slot.subject.code as SubjectCode;
      const list = TOPICS[code] ?? ["Revision"];
      const k = `${slot.classId}-${code}`;
      topicIndex[k] = (topicIndex[k] ?? -1) + (chance(0.45) ? 1 : 0);
      const topic = list[Math.max(0, topicIndex[k]) % list.length];
      lessonRows.push({
        timetableSlotId: slot.id, date: day, topic,
        subtopics: chance(0.6) ? pick(["Introduction and examples", "Class exercise", "Group work", "Homework set", "Corrections of previous work", "Practical activity", "Quiz"]) : null,
        createdById: slot.teacherId, createdAt: atTime(day, 15, randInt(0, 59)),
      });
    }
  }
  for (const part of chunk(lessonRows, 5000)) await prisma.lessonLog.createMany({ data: part, skipDuplicates: true });
  console.log(`✅ ${lessonRows.length.toLocaleString()} lesson logs for Term 3`);

  // ── Report cards via the app's own generator (Term 1 all classes; Term 2 all but Grade 12 A)
  const { reportCardService } = await import("@/features/report-cards/reportCard.service");
  const ctx = adminCtx;
  let rcCount = 0;
  for (const t of ["TERM_1", "TERM_2"] as const) {
    for (const cls of classes) {
      if (t === "TERM_2" && cls.label === "Grade 12 A") continue; // left for the live "Bulk Generate" demo
      const res = await reportCardService.bulkGenerateReportCards(cls.id, termIds[t], profileIdByKey[cls.classTeacherKey], ctx);
      if (res.failed.length) console.warn(`   ⚠️ ${cls.label} ${t}: ${res.failed.length} failed`, res.failed[0]);
      rcCount += res.successful;
      await reportCardService.calculateClassPositions(cls.id, termIds[t], ctx);
    }
    // Remarks, like a class teacher and head teacher would add
    const cards = await prisma.reportCard.findMany({ where: { termId: termIds[t] }, select: { id: true, averageMark: true } });
    for (const card of cards) {
      const avg = card.averageMark ?? 0;
      const band = avg >= 70 ? "excellent" : avg >= 55 ? "good" : avg >= 42 ? "average" : "weak";
      await prisma.reportCard.update({ where: { id: card.id }, data: { classTeacherRemarks: pick(CLASS_TEACHER_REMARKS[band]), headTeacherRemarks: HEAD_REMARKS[band] } });
    }
  }
  console.log(`✅ ${rcCount} report cards generated (Term 2 for Grade 12 A left for your live demo)`);

  // ── SMS templates (the app's defaults) + message history
  const { smsService } = await import("@/features/sms/sms.service");
  try { await smsService.seedDefaultTemplates(adminCtx); } catch (e) { console.warn("   ⚠️ SMS templates not seeded:", (e as Error).message); }

  const smsRows: Prisma.SMSLogCreateManyInput[] = [];
  const primaryGuardians = new Map<string, StudentInfo>();
  for (const s of students) if (!primaryGuardians.has(s.guardianId)) primaryGuardians.set(s.guardianId, s);
  const smsStatus = () => { const r = rand(); return r < 0.93 ? "DELIVERED" : r < 0.97 ? "SENT" : "FAILED"; };
  function addSms(s: StudentInfo, message: string, when: Date) {
    const status = smsStatus();
    smsRows.push({
      guardianId: s.guardianId, studentId: s.id, phoneNumber: s.phone, message, status, provider: "AFRICAS_TALKING",
      messageId: `ATXid_demo_${smsRows.length + 1}`, cost: 0.3, sentAt: status === "FAILED" ? null : when,
      error: status === "FAILED" ? "Invalid phone number or network unreachable" : null, sentBy: userIdByKey["ADMIN"], createdAt: when,
    });
  }
  const firstName = (s: StudentInfo) => s.name.split(" ")[0];
  for (const s of primaryGuardians.values()) {
    addSms(s, `Kaliwe Heights SS: Term 2 report cards for ${firstName(s)} are ready. Please collect them from the class teacher. Thank you.`, atTime(d("2026-08-06"), 14, 5));
    addSms(s, `Kaliwe Heights SS: Term 3 opens on Monday 7 September 2026. Learners must report by 07:15 in full uniform.`, atTime(d("2026-09-03"), 10, 0));
    if (d("2026-10-01") <= TODAY) addSms(s, `Kaliwe Heights SS: Parents/Guardians are invited to a PTA meeting on Saturday 10 October 2026 at 09:00 in the school hall.`, atTime(d("2026-10-01"), 11, 30));
  }
  for (const [day, absentees] of Object.entries(absencesByDay)) {
    for (const s of absentees) {
      if (!chance(0.6)) continue;
      addSms(s, `Kaliwe Heights SS: ${firstName(s)} was marked ABSENT today (${day}). Please contact the school if this is unexpected.`, atTime(d(day), 9, randInt(0, 40)));
    }
  }
  for (const part of chunk(smsRows, 5000)) await prisma.sMSLog.createMany({ data: part });
  console.log(`✅ ${smsRows.length.toLocaleString()} SMS log entries (all simulated, nothing was actually sent)`);

  // ── Staff notifications
  const notes: Prisma.NotificationCreateManyInput[] = [];
  const note = (from: string, to: string, subject: string, message: string, type: Prisma.NotificationCreateManyInput["type"], priority: Prisma.NotificationCreateManyInput["priority"], when: Date, read: boolean) =>
    notes.push({ senderId: userIdByKey[from], recipientId: userIdByKey[to], subject, message, type, priority, status: read ? "READ" : "UNREAD", readAt: read ? atTime(when, 2) : null, createdAt: when });

  for (const t of TEACHERS) {
    note("HEAD_TEACHER", t.key, "Welcome to Term 3", "Welcome back! Lesson logs and daily registers must be updated every day. End of term exams run 16 to 27 November.", "SYSTEM_ANNOUNCEMENT", "NORMAL", atTime(d("2026-09-07"), 7, 0), true);
  }
  const hodOf = (key: string) => {
    const t = TEACHERS.find((x) => x.key === key)!;
    const dep = SUBJECTS.find((s) => s.code === t.subjects[0])!.dept;
    return TEACHERS.find((x) => "hodOf" in x && x.hodOf === dep)!.key;
  };
  for (const [teacherKey, pending] of Object.entries(pendingMidByTeacher)) {
    const hod = hodOf(teacherKey);
    if (hod === teacherKey) continue;
    note(hod, teacherKey, "Reminder: Mid-term marks due Friday", `Please complete mark entry for: ${pending.slice(0, 3).join(", ")}${pending.length > 3 ? "…" : ""}. The window closes on 16 October.`, "ASSESSMENT_REMINDER", "HIGH", atTime(d("2026-10-08"), 16, 10), chance(0.4));
  }
  note("pmwale", "bchanda", "Mid-term deadline extended", "Your Grade 10 B Physics mid-term entry deadline has been extended to Tuesday 20 October because of the laboratory practical.", "DEADLINE_EXTENSION", "NORMAL", atTime(d("2026-10-09"), 11, 0), false);
  note("DEPUTY_HEAD", "HEAD_TEACHER", "Term 2 report cards", "All Term 2 report cards have been printed except Grade 12 A. Please generate them before the PTA meeting.", "APPROVAL_REQUEST", "HIGH", atTime(d("2026-10-07"), 9, 15), false);
  await prisma.notification.createMany({ data: notes });
  console.log(`✅ ${notes.length} staff notifications`);

  console.log(`
🎉 Demo school ready!

   Log in with password: ${PASSWORD}${process.env.DEMO_SEED_PASSWORD ? "  (DEMO_SEED_PASSWORD)" : "  (random — note it down)"}
   ─────────────────────────────────────────────
   Head teacher ..... head@${DOMAIN}
   Deputy head ...... deputy@${DOMAIN}
   Clerk (admin) .... admin@${DOMAIN}
   HOD (Maths/Sci) .. hod.maths@${DOMAIN}
   HOD (Languages) .. hod.languages@${DOMAIN}
   Teacher .......... teacher@${DOMAIN}   (Esther Banda, Maths, class teacher of Form 2 A)
   ─────────────────────────────────────────────
   Live demo idea: Head teacher → Report Cards → Term 2 → Grade 12 A → Bulk Generate.
`);
}

main().catch((e) => {
  console.error("❌ Demo seed failed:", e);
  process.exit(1);
});
