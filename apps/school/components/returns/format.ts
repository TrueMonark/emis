import { total, type MaleFemale } from "@school/shared/returns/indicators";

/** "12,345" / "–" */
export const num = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString("en-GB"));

/** "92.5%" / "–" */
export const pct = (n: number | null | undefined) => (n == null ? "–" : `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`);

/** "38.2" (a ratio such as learners per teacher) / "–" */
export const per = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString("en-GB", { maximumFractionDigits: 1 }));

export const mfTotal = (mf: MaleFemale) => total(mf);

/** 01/10/2026 from YYYY-MM-DD */
export const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC" });

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";
