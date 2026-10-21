/**
 * Signing in with an email address or a Zambian mobile number (Phase 4b).
 *
 * Mobile numbers are stored as +260XXXXXXXXX. People type them in many ways ("0977 123 456",
 * "260977123456", "+260-977-123456"), so both the server and the screens use these helpers.
 */

/** "0977 123 456" / "260977123456" / "+260 977 123 456" → "+260977123456"; null if not a number. */
export function normalizeZambianPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s\-().]/g, "");
  if (/^\+260\d{9}$/.test(compact)) return compact;
  if (/^260\d{9}$/.test(compact)) return `+${compact}`;
  if (/^0\d{9}$/.test(compact)) return `+260${compact.slice(1)}`;
  return null;
}

export type SignInId =
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string };

/** What the person typed in the sign-in box: an email (has "@") or a mobile number. */
export function parseSignInId(input: string): SignInId | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return { kind: "email", value: trimmed.toLowerCase() };
  const phone = normalizeZambianPhone(trimmed);
  return phone ? { kind: "phone", value: phone } : null;
}

/** "+260977123456" → "0977 123 456" (how numbers are shown on screens). */
export function formatZambianPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const m = /^\+260(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : phone;
}
