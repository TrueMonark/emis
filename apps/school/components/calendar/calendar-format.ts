/** Calendar dates arrive as YYYY-MM-DD: show them as "Sat 24/10/2026" without shifting the day. */
export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export const isWeekendIso = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
};

/** Weekdays (Monday–Friday) from start to end, inclusive. */
export function weekdaysBetween(start: string, end: string): number {
  let n = 0;
  for (let t = new Date(`${start}T00:00:00Z`).getTime(); t <= new Date(`${end}T00:00:00Z`).getTime(); t += 86_400_000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}
