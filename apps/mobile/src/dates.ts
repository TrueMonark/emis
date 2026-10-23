/**
 * Dates on the phone. A "day" is YYYY-MM-DD in the phone's own calendar (the teacher's day);
 * the server stores days as UTC midnight, so "2026-10-16T00:00:00.000Z" is 16 October.
 */
const pad = (n: number) => String(n).padStart(2, "0");

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The day part of a server date ("2026-10-16T00:00:00.000Z" → "2026-10-16"). */
export const dayOf = (value: unknown): string => (typeof value === "string" ? value.slice(0, 10) : "");

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DAY_KEYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/** "MONDAY" … for a YYYY-MM-DD day. */
export const dayKeyOf = (iso: string): DayKey => DAY_KEYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

export const WEEKDAYS: DayKey[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
export const dayName = (k: DayKey) => k.charAt(0) + k.slice(1).toLowerCase();

/** "Fri 16/10/2026" */
export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/** "16/10/2026 14:05" */
export const dateTimeLabel = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "never";
