/**
 * School Based Assessment (SBA) score sheets (Phase 9b, 4 November 2026).
 *
 * The ECZ's SBA score sheet for the 2023 curriculum has six tasks per year level (two per term:
 * Tasks 1–2 in Term 1, 3–4 in Term 2, 5–6 in Term 3) and a total per year level. Each task is
 * marked like an assignment, out of what the teacher sets (decided 4 November 2026: the
 * maximum stays adjustable until the official rule is known).
 */

export const SBA_TASKS = [1, 2, 3, 4, 5, 6] as const;
export type SbaTaskNumber = (typeof SBA_TASKS)[number];

/** Term of a task: 1–2 → 1, 3–4 → 2, 5–6 → 3. */
export const sbaTermOf = (task: number) => Math.ceil(task / 2);

export const SBA_DEFAULT_MAX_MARKS = 100;

/** Which year levels keep SBA sheets: O-level (Forms 1–4) on the 2023 curriculum. */
export function hasSba(grade: { stage: string; curriculum: string }): boolean {
  return grade.stage === "O_LEVEL" && grade.curriculum === "CBC_2023";
}

export const SBA_STATUSES = ["NOT_STARTED", "DRAFT", "SUBMITTED", "RETURNED", "HOD_APPROVED", "CONFIRMED"] as const;
export type SbaStatusValue = (typeof SBA_STATUSES)[number];

export const SBA_STATUS_LABELS: Record<SbaStatusValue, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  SUBMITTED: "Waiting for the HOD",
  RETURNED: "Sent back",
  HOD_APPROVED: "Waiting for the head",
  CONFIRMED: "Confirmed",
};

export const SBA_EVENT_LABELS: Record<string, string> = {
  STARTED: "Sheet started",
  SUBMITTED: "Submitted to the HOD",
  RETURNED: "Sent back to the teacher",
  HOD_APPROVED: "Approved by the HOD",
  CONFIRMED: "Confirmed by the head teacher",
  REOPENED: "Reopened by the head teacher",
};

export interface SbaTaskInfo {
  number: number;
  maxMarks: number;
}

export interface SbaMarkValue {
  marks: number | null;
  isAbsent: boolean;
}

/**
 * A learner's total on a sheet: marks added up over the tasks marked so far (absent counts as
 * 0), out of those tasks' maxima. `complete` = every task has a mark or "absent".
 */
export function sbaTotal(tasks: SbaTaskInfo[], marksByTask: Map<number, SbaMarkValue | undefined>) {
  let score = 0;
  let outOf = 0;
  let done = 0;
  for (const t of tasks) {
    const m = marksByTask.get(t.number);
    if (!m || (m.marks == null && !m.isAbsent)) continue;
    done++;
    outOf += t.maxMarks;
    score += m.isAbsent ? 0 : m.marks ?? 0;
  }
  return {
    score: Math.round(score * 10) / 10,
    outOf,
    percent: outOf > 0 ? Math.round((score / outOf) * 1000) / 10 : null,
    complete: done === tasks.length,
  };
}
