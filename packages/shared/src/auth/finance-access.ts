/**
 * The Finance role (school fees, requested 19 October 2026) has nothing to do with teaching: its
 * accounts may only use the fees API, plus signing in, their own account and notifications.
 * Enforced by the server (with-auth.ts), not just by hiding pages.
 */
export const FINANCE_ALLOWED_PREFIXES = [
  "/api/finance/",
  "/api/auth/",
  "/api/school/identity",
  "/api/notifications",
] as const;

export function isAllowedForFinance(path: string): boolean {
  return FINANCE_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`) || path.startsWith(`${p}?`));
}

export const FINANCE_ONLY_MESSAGE = "Finance accounts can only use the school fees pages.";
