import type { ZodError } from "zod";

/** A readable message from the first problem Zod found, e.g. "head.phone: Use a Zambian number…". */
export function firstIssueMessage(error: ZodError, fallback: string): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${where}${issue.message}`;
}
