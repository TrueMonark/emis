import { normalizeZambianPhone } from "@school/shared/auth/sign-in-id";
import { authRepository } from "./auth.repository";
import { logger } from "@/lib/logger/logger";

/**
 * Signing in with a mobile number (Phase 4b). One number opens one account, so a number is only
 * set on an account when no other account already uses it. Families and colleagues sometimes
 * share a phone; those people keep signing in with their email until it's sorted out.
 */

/** The number in stored form if it can be used to sign in to this account, else null. */
export async function signInPhoneFor(phone: string | null | undefined, userId?: string): Promise<string | null> {
  const normalised = phone ? normalizeZambianPhone(phone) : null;
  if (!normalised) return null;
  const owner = await authRepository.findUserIdByPhone(normalised);
  return !owner || owner === userId ? normalised : null;
}

/**
 * After a profile's phone changed: let the person sign in with the new number (when it's free).
 * Never fails the change that triggered it.
 */
export async function syncSignInPhone(userId: string, phone: string | null | undefined): Promise<void> {
  try {
    const usable = await signInPhoneFor(phone, userId);
    if (usable) await authRepository.setPhone(userId, usable);
    else if (phone) logger.info("Mobile number already used to sign in to another account", { userId });
  } catch (error) {
    logger.error("Couldn't update sign-in mobile number", error instanceof Error ? error : undefined, { userId });
  }
}
