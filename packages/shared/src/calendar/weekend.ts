/**
 * Weekends (Phase 5). Attendance is never taken on a Saturday or Sunday, except for an approved
 * special (weekend) class, which has its own register.
 *
 * Attendance dates are stored as UTC midnight of the day, so a Date is judged by its UTC day; a
 * "YYYY-MM-DD" string by its calendar day.
 */
export function isWeekend(date: Date | string): boolean {
  const d =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00.000Z`)
      : new Date(date);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export const WEEKEND_ATTENDANCE_MESSAGE =
  "Attendance can't be taken on a Saturday or Sunday. For a weekend lesson, ask for a special class under Weekend classes; once your HOD approves it, take its register there.";
