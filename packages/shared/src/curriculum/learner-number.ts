/**
 * System-wide learner number (decision 4, 12 October 2026):
 *
 *   ZM26-4K7Q2PB-H
 *   │ │  │       └ check character
 *   │ │  └ 7 random characters
 *   │ └ year of first registration (two digits)
 *   └ Zambia
 *
 * The 31 characters used leave out 0/O, 1/I and L, which are easily misread. The check
 * character is a weighted sum modulo 31 (a prime), so a single mistyped character, or two
 * neighbouring characters swapped within the 7, is always caught.
 */

export const LEARNER_NUMBER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const BASE = LEARNER_NUMBER_ALPHABET.length; // 31
const BODY_LENGTH = 7;

const PATTERN = new RegExp(
  `^ZM(\\d{2})([${LEARNER_NUMBER_ALPHABET}]{${BODY_LENGTH}})([${LEARNER_NUMBER_ALPHABET}])$`
);

/** Check character for the two year digits plus the 7-character body. */
export function learnerNumberCheckChar(yearDigits: string, body: string): string {
  const values = [
    ...yearDigits.split("").map((d) => Number(d)),
    ...body.split("").map((c) => {
      const v = LEARNER_NUMBER_ALPHABET.indexOf(c);
      if (v < 0) throw new Error(`Character "${c}" isn't used in learner numbers`);
      return v;
    }),
  ];
  const sum = values.reduce((acc, v, i) => acc + (i + 1) * v, 0);
  return LEARNER_NUMBER_ALPHABET[sum % BASE];
}

/** Formats as ZM26-4K7Q2PB-H. */
function format(yearDigits: string, body: string, check: string): string {
  return `ZM${yearDigits}-${body}-${check}`;
}

/**
 * A new random learner number for the given registration year. `random` returns a number in
 * [0, 1). New learners get their number from the database (emis_new_learner_number(), same
 * rules); this is for tools and tests.
 */
export function generateLearnerNumber(
  year: number,
  random: () => number = Math.random
): string {
  const yearDigits = String(year % 100).padStart(2, "0");
  let body = "";
  for (let i = 0; i < BODY_LENGTH; i++) {
    body += LEARNER_NUMBER_ALPHABET[Math.floor(random() * BASE) % BASE];
  }
  return format(yearDigits, body, learnerNumberCheckChar(yearDigits, body));
}

/**
 * Tidies what someone typed (spaces, dashes, lower case) and checks it. Returns the number in standard form, or null if it isn't a valid learner number.
 */
export function normalizeLearnerNumber(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s\-–]/g, "");
  const m = PATTERN.exec(compact);
  if (!m) return null;
  const [, yearDigits, body, check] = m;
  if (learnerNumberCheckChar(yearDigits, body) !== check) return null;
  return format(yearDigits, body, check);
}

export function isValidLearnerNumber(input: string): boolean {
  return normalizeLearnerNumber(input) !== null;
}

/** True when the text looks like someone is typing a learner number (for search boxes). */
export function looksLikeLearnerNumber(input: string): boolean {
  return /^\s*ZM\d{2}/i.test(input);
}
