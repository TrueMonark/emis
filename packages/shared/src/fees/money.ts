/**
 * School fees money (requested 19 October 2026). Amounts are kept as whole ngwee (K1 = 100
 * ngwee), so adding up thousands of payments is exact. Convert only for display and input.
 */

/** 450050 → "K4,500.50" */
export function formatKwacha(ngwee: number | null | undefined, options: { sign?: boolean } = {}): string {
  const n = Math.round(ngwee ?? 0);
  const negative = n < 0;
  const abs = Math.abs(n);
  const kwacha = Math.floor(abs / 100).toLocaleString("en-GB");
  const cents = String(abs % 100).padStart(2, "0");
  const text = `K${kwacha}.${cents}`;
  if (negative) return `-${text}`;
  return options.sign && n > 0 ? `+${text}` : text;
}

/** "4,500.50" / "K4500.5" / "4500" → 450050; null if it isn't an amount. */
export function parseKwacha(text: string): number | null {
  const cleaned = text.trim().replace(/^K\s*/i, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export const FEE_CATEGORY_LABELS: Record<string, string> = {
  TUITION: "Tuition",
  BOARDING: "Boarding",
  TRANSPORT: "Transport",
  MEALS: "Meals",
  EXAMINATION: "Examination",
  UNIFORM: "Uniform",
  BOOKS: "Books",
  DEVELOPMENT: "Development / PTA",
  TRIP: "Trip",
  EVENT: "Event",
  OTHER: "Other",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_DEPOSIT: "Bank deposit",
  BANK_TRANSFER: "Bank transfer",
  MOBILE_MONEY: "Mobile money",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

/** Methods that need a reference (slip number, transaction id, cheque number). */
export const METHODS_NEEDING_REFERENCE = ["BANK_DEPOSIT", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE"] as const;
