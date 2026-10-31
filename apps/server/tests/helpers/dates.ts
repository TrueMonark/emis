import { zambianPublicHolidays } from "@school/shared/calendar/zambia-holidays";

/**
 * A weekday that isn't a built-in public holiday (Phase 5b: no registers on holidays). Tests
 * that take registers "on the latest school day" use this so they pass whatever day they run.
 */
export function isSchoolDayForTests(d: Date): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  const iso = d.toISOString().slice(0, 10);
  return !zambianPublicHolidays(d.getUTCFullYear()).some((h) => h.date === iso);
}
