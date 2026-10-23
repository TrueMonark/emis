import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

/**
 * Small secrets kept in the phone's secure storage (Keychain / Keystore): the server address,
 * the sign-in token and who is signed in, the device id, and the app PIN (hashed).
 */

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  schoolName: string | null;
}

export interface Session {
  serverUrl: string;
  token: string;
  user: SessionUser;
  /** The one-time password is still in use: the app asks for a new password first */
  mustChangePassword: boolean;
}

const KEYS = { session: "monark.session", device: "monark.device", pin: "monark.pin", server: "monark.server" };

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEYS.session);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export const saveSession = (s: Session) => SecureStore.setItemAsync(KEYS.session, JSON.stringify(s));
export const clearSession = () => SecureStore.deleteItemAsync(KEYS.session);

/** The last server address typed in (kept after signing out, to save typing). */
export const loadServerUrl = () => SecureStore.getItemAsync(KEYS.server);
export const saveServerUrl = (url: string) => SecureStore.setItemAsync(KEYS.server, url);

/** A random id for this phone, sent with every push. */
export async function deviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEYS.device);
  if (existing) return existing;
  const id = `phone-${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(KEYS.device, id);
  return id;
}

// ── PIN ─────────────────────────────────────────────────────────────────────

interface StoredPin {
  /** Whose PIN it is */
  userId: string;
  salt: string;
  hash: string;
  failed: number;
}

const hashPin = (pin: string, salt: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

export const MAX_PIN_ATTEMPTS = 5;

export async function hasPin(userId: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(KEYS.pin);
  if (!raw) return false;
  try {
    return (JSON.parse(raw) as StoredPin).userId === userId;
  } catch {
    return false;
  }
}

export async function setPin(userId: string, pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  const stored: StoredPin = { userId, salt, hash: await hashPin(pin, salt), failed: 0 };
  await SecureStore.setItemAsync(KEYS.pin, JSON.stringify(stored));
}

/** Checks the PIN. After too many wrong tries the PIN is removed and the password is needed. */
export async function checkPin(pin: string): Promise<{ ok: boolean; attemptsLeft: number }> {
  const raw = await SecureStore.getItemAsync(KEYS.pin);
  if (!raw) return { ok: false, attemptsLeft: 0 };
  const stored = JSON.parse(raw) as StoredPin;
  if ((await hashPin(pin, stored.salt)) === stored.hash) {
    if (stored.failed) await SecureStore.setItemAsync(KEYS.pin, JSON.stringify({ ...stored, failed: 0 }));
    return { ok: true, attemptsLeft: MAX_PIN_ATTEMPTS };
  }
  const failed = stored.failed + 1;
  if (failed >= MAX_PIN_ATTEMPTS) {
    await SecureStore.deleteItemAsync(KEYS.pin);
    return { ok: false, attemptsLeft: 0 };
  }
  await SecureStore.setItemAsync(KEYS.pin, JSON.stringify({ ...stored, failed }));
  return { ok: false, attemptsLeft: MAX_PIN_ATTEMPTS - failed };
}

export const clearPin = () => SecureStore.deleteItemAsync(KEYS.pin);
