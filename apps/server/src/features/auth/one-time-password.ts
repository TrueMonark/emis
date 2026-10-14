import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * One-time passwords for new accounts and password resets.
 *
 * Every new account and every reset gets its own random password, shown once to the person who
 * created/reset it and handed over in person (or sent by SMS). The account is marked
 * `hasDefaultPassword`, so the server allows nothing except changing it (see with-auth.ts), and
 * it stops working after `OTP_TTL_HOURS` (default 24) if never used.
 *
 * Never replace this with a fixed password: a shared password across a national system is
 * known to everyone.
 */

// No 0/O, 1/I/L, so it can be read out over the phone and typed without mistakes.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const GROUP_LENGTH = 4;

/** e.g. "K7QP-2MXA-9FHT" — 12 random characters, about 59 bits. */
export function generateOneTimePassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LENGTH; i++) {
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

export function oneTimePasswordTtlHours(): number {
  const hours = Number(process.env.OTP_TTL_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours : 24;
}

export interface IssuedOneTimePassword {
  /** Show this once to the person who created/reset the account. Never store or log it. */
  password: string;
  passwordHash: string;
  expiresAt: Date;
}

export async function issueOneTimePassword(now: Date = new Date()): Promise<IssuedOneTimePassword> {
  const password = generateOneTimePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const expiresAt = new Date(now.getTime() + oneTimePasswordTtlHours() * 60 * 60 * 1000);
  return { password, passwordHash, expiresAt };
}
