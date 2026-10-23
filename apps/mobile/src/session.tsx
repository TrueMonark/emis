import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { normalizeZambianPhone } from "@school/shared/auth/sign-in-id";
import { ApiError, call, normaliseServerUrl, request } from "./api";
import { getMeta, pendingCount, setMeta, wipeAll } from "./db";
import { checkPin, clearPin, clearSession, hasPin, loadSession, saveServerUrl, saveSession, setPin, type Session } from "./storage";
import { getSyncState, me, syncNow } from "./sync";
import { cancelAllReminders } from "./reminders";

/**
 * Who is signed in, and whether the app is unlocked.
 *
 * - First time on a phone: sign in online (email or mobile number + password). A one-time
 *   password must be changed first. Then the first download, then the teacher chooses a PIN.
 * - After that the app opens with the PIN, online or not. It locks again after 2 minutes in the
 *   background. Five wrong PINs and the password is needed again (online).
 * - A different teacher signing in on the same phone gets a clean phone (the previous teacher's
 *   unsent changes are lost, and the app says so first).
 */

export type Stage = "loading" | "signedOut" | "changePassword" | "setPin" | "locked" | "ready";

interface LoginUser {
  id: string;
  email: string;
  displayName?: string | null;
  role: string;
  hasDefaultPassword: boolean;
  profile?: { firstName: string; lastName: string } | null;
  school?: { name: string } | null;
  office?: unknown;
}

interface SessionApi {
  stage: Stage;
  session: Session | null;
  online: boolean;
  signIn: (serverUrl: string, identifier: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  choosePin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<{ ok: boolean; attemptsLeft: number }>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
}

const Ctx = createContext<SessionApi | null>(null);
const LOCK_AFTER_MS = 2 * 60 * 1000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [online, setOnline] = useState(true);
  const backgroundAt = useRef<number | null>(null);

  // Start: a saved session opens with the PIN.
  useEffect(() => {
    (async () => {
      const s = await loadSession();
      if (!s) return setStage("signedOut");
      setSession(s);
      if (s.mustChangePassword) return setStage("changePassword");
      setStage((await hasPin(s.user.userId)) ? "locked" : "setPin");
    })();
  }, []);

  // Lock after a while in the background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") backgroundAt.current = Date.now();
      if (next === "active" && backgroundAt.current && Date.now() - backgroundAt.current > LOCK_AFTER_MS) {
        setStage((s) => (s === "ready" ? "locked" : s));
      }
      if (next === "active") backgroundAt.current = null;
    });
    return () => sub.remove();
  }, []);

  // Sync whenever the connection comes back (and keep "online" for the screens).
  useEffect(() => {
    return NetInfo.addEventListener((net) => {
      const isOnline = !!net.isConnected;
      setOnline(isOnline);
      if (isOnline && session && stage === "ready") void syncNow(session);
    });
  }, [session, stage]);

  const signIn = useCallback(async (serverInput: string, identifierInput: string, password: string) => {
    const serverUrl = normaliseServerUrl(serverInput);
    const raw = identifierInput.trim();
    const identifier = raw.includes("@") ? raw.toLowerCase() : normalizeZambianPhone(raw) ?? raw;
    const data = await request<{ token: string; user: LoginUser }>(serverUrl, "/auth/login", { method: "POST", body: { identifier, password } });
    const u = data.user;
    if (!u.school) throw new ApiError("This app is for teachers at a school. Office staff use the website.", 403);

    // A different person on this phone: start clean.
    const previous = getMeta<string>("userId");
    if (previous && previous !== u.id) {
      wipeAll();
      await clearPin();
    }
    setMeta("userId", u.id);

    const s: Session = {
      serverUrl,
      token: data.token,
      mustChangePassword: u.hasDefaultPassword,
      user: {
        userId: u.id,
        email: u.email,
        role: u.role,
        name: u.profile ? `${u.profile.firstName} ${u.profile.lastName}` : u.displayName || u.email,
        schoolName: u.school?.name ?? null,
      },
    };
    await saveServerUrl(serverUrl);
    await saveSession(s);
    setSession(s);
    if (s.mustChangePassword) return setStage("changePassword");
    try {
      await firstDownload(s);
    } catch (error) {
      await clearSession();
      setSession(null);
      throw error;
    }
    setStage((await hasPin(u.id)) ? "ready" : "setPin");
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!session) return;
      await call(session, "/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
      const s = { ...session, mustChangePassword: false };
      await saveSession(s);
      setSession(s);
      await firstDownload(s);
      setStage((await hasPin(s.user.userId)) ? "ready" : "setPin");
    },
    [session]
  );

  const choosePin = useCallback(
    async (pin: string) => {
      if (!session) throw new Error("You're not signed in any more. Close the app and sign in again.");
      await setPin(session.user.userId, pin);
      setStage("ready");
    },
    [session]
  );

  const unlock = useCallback(
    async (pin: string) => {
      const r = await checkPin(pin);
      if (r.ok) {
        setStage("ready");
        if (session) void syncNow(session);
      } else if (r.attemptsLeft === 0) {
        // Too many wrong PINs: the password is needed (the phone's data is kept for the same teacher).
        await clearSession();
        setSession(null);
        setStage("signedOut");
      }
      return r;
    },
    [session]
  );

  const signOut = useCallback(async () => {
    await cancelAllReminders().catch(() => undefined);
    wipeAll();
    await clearPin();
    await clearSession();
    setSession(null);
    setStage("signedOut");
  }, []);

  const sync = useCallback(async () => {
    if (session) await syncNow(session);
  }, [session]);

  const value = useMemo<SessionApi>(
    () => ({ stage, session, online, signIn, changePassword, choosePin, unlock, signOut, sync }),
    [stage, session, online, signIn, changePassword, choosePin, unlock, signOut, sync]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The first download after signing in; refuses accounts that can't use the app. */
async function firstDownload(s: Session) {
  await syncNow(s);
  if (!me()) {
    const st = getSyncState();
    throw new ApiError(st.blocked ?? st.lastError ?? "The first download didn't finish. Check the connection and try again.", 0);
  }
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

export { pendingCount };
