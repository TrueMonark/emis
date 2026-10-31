/**
 * Zambia's public holidays (Public Holidays Act, Cap. 272), worked out for any year (Phase 5b,
 * 21 October 2026).
 *
 * - Fixed dates, plus Easter (Good Friday, Holy Saturday, Easter Monday), Heroes' Day (first
 *   Monday of July), Unity Day (the Tuesday after) and Farmers' Day (first Monday of August).
 * - A holiday that falls on a Sunday is also observed on the Monday after.
 * - National Day of Prayer: 18 October up to 2025. From 2026 it is 29 December, the "National
 *   Day of Prayer and Christian Heritage" (government and the church mother bodies, 9 October
 *   2026; 18 October 2026 was cancelled as a holiday).
 *
 * The law changes from time to time (a Public Holidays (Amendment) Bill was before Parliament
 * in 2026), and the President can declare extra days. That's what the HQ "national holiday
 * changes" are for: they add or cancel days on top of this list, without a code change.
 */

export interface PublicHoliday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  /** The Monday after a holiday that fell on a Sunday */
  observed?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h - 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/** The first given weekday (0 = Sunday … 6 = Saturday) of a month. */
function firstWeekday(year: number, month: number, weekday: number): Date {
  const first = utc(year, month, 1);
  return addDays(first, (weekday - first.getUTCDay() + 7) % 7);
}

/** Every public holiday of the year, in date order. */
export function zambianPublicHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);
  const heroes = firstWeekday(year, 7, 1);
  const days: { date: Date; name: string; sundayRule: boolean }[] = [
    { date: utc(year, 1, 1), name: "New Year's Day", sundayRule: true },
    { date: utc(year, 3, 8), name: "International Women's Day", sundayRule: true },
    { date: utc(year, 3, 12), name: "Youth Day", sundayRule: true },
    { date: addDays(easter, -2), name: "Good Friday", sundayRule: false },
    { date: addDays(easter, -1), name: "Holy Saturday", sundayRule: false },
    { date: addDays(easter, 1), name: "Easter Monday", sundayRule: false },
    ...(year >= 2022 ? [{ date: utc(year, 4, 28), name: "Kenneth Kaunda Day", sundayRule: true }] : []),
    { date: utc(year, 5, 1), name: "Labour Day", sundayRule: true },
    { date: utc(year, 5, 25), name: "Africa Freedom Day", sundayRule: true },
    { date: heroes, name: "Heroes' Day", sundayRule: false },
    { date: addDays(heroes, 1), name: "Unity Day", sundayRule: false },
    { date: firstWeekday(year, 8, 1), name: "Farmers' Day", sundayRule: false },
    ...(year <= 2025 ? [{ date: utc(year, 10, 18), name: "National Day of Prayer", sundayRule: true }] : []),
    { date: utc(year, 10, 24), name: "Independence Day", sundayRule: true },
    { date: utc(year, 12, 25), name: "Christmas Day", sundayRule: true },
    ...(year >= 2026 ? [{ date: utc(year, 12, 29), name: "National Day of Prayer and Christian Heritage", sundayRule: true }] : []),
  ];

  const out: PublicHoliday[] = [];
  const taken = new Set(days.map((d) => ymd(d.date)));
  for (const d of days) {
    out.push({ date: ymd(d.date), name: d.name });
    if (d.sundayRule && d.date.getUTCDay() === 0) {
      // Observed on the Monday after (or the next free day, if that is a holiday too).
      let monday = addDays(d.date, 1);
      while (taken.has(ymd(monday))) monday = addDays(monday, 1);
      taken.add(ymd(monday));
      out.push({ date: ymd(monday), name: `${d.name} (observed)`, observed: true });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface NationalHolidayChange {
  /** YYYY-MM-DD */
  date: string;
  kind: "ADD" | "CANCEL";
  name: string;
}

/** The built-in list with HQ's changes applied (added days in, cancelled days out). */
export function applyHolidayChanges(builtIn: PublicHoliday[], changes: NationalHolidayChange[]): PublicHoliday[] {
  const cancelled = new Set(changes.filter((c) => c.kind === "CANCEL").map((c) => c.date));
  const kept = builtIn.filter((h) => !cancelled.has(h.date));
  const dates = new Set(kept.map((h) => h.date));
  const added = changes
    .filter((c) => c.kind === "ADD" && !dates.has(c.date))
    .map((c) => ({ date: c.date, name: c.name }));
  return [...kept, ...added].sort((a, b) => a.date.localeCompare(b.date));
}

export const HOLIDAY_ATTENDANCE_MESSAGE = (label: string) =>
  `There's no register on ${label}. For a lesson that day, ask for a special class under Weekend classes; once your HOD approves it, take its register there.`;
