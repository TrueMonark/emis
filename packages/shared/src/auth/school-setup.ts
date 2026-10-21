/**
 * A new school (registered by its district office) starts in setup. Until the head teacher
 * finishes it, the server answers school requests outside the setup steps with 403, this code
 * and this header; the screens send the person to /setup when they see it.
 */
export const SCHOOL_SETUP_REQUIRED = "SCHOOL_SETUP_REQUIRED";
export const SCHOOL_SETUP_REQUIRED_HEADER = "X-School-Setup-Required";

/**
 * API paths that work while a school is in setup: signing in and the account, the school's own
 * details, and what the setup steps need (academic year, terms, year levels, subjects).
 */
export const SETUP_ALLOWED_PREFIXES = [
  "/api/auth/",
  "/api/school/",
  "/api/academic-years",
  "/api/terms",
  "/api/year-levels",
  "/api/grade-levels",
  "/api/curriculum/",
  "/api/subjects",
  "/api/departments",
  "/api/admin/settings/school-info",
  "/api/notifications",
] as const;

export function isAllowedDuringSetup(path: string): boolean {
  return SETUP_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`) || path.startsWith(`${p}?`));
}
