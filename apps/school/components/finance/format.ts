import { FEE_CATEGORY_LABELS, formatKwacha } from "@school/shared/fees/money";

export { formatKwacha };

/** Dates from the API are UTC midnights: show DD/MM/YYYY without shifting the day. */
export const dayLabel = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";

export const dateTimeLabel = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/** Today as YYYY-MM-DD in the person's own day. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  PAID: { label: "Paid", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  PART_PAID: { label: "Part paid", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  UNPAID: { label: "Not paid", className: "bg-destructive/15 text-destructive" },
  WAIVED: { label: "Waived", className: "bg-muted text-muted-foreground" },
};

/** Amount cell text: "K0.00" in muted style is handled by the caller. */
export const k = (ngwee: number) => formatKwacha(ngwee);

/** "10% off Tuition, Boarding" / "K500.00 off all fees" */
export const discountText = (d: { kind: "PERCENT" | "AMOUNT"; value: number; categories: string[] }) =>
  `${d.kind === "PERCENT" ? `${d.value}%` : formatKwacha(d.value)} off ${
    d.categories.length ? d.categories.map((c) => FEE_CATEGORY_LABELS[c] ?? c).join(", ") : "all fees"
  }`;
