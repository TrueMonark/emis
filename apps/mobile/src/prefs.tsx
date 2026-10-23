import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";
import { applyPalette, colors } from "./theme";

/**
 * This phone's settings: light / dark, and the reminders. Kept on the phone only (they survive
 * signing out), in secure storage like the other small settings.
 */

export type ThemeMode = "system" | "light" | "dark";

export interface ReminderPrefs {
  /** Before each lesson on my timetable */
  lessons: { on: boolean; minutes: number };
  /** The morning daily register (class teachers and covers) */
  register: { on: boolean; time: string };
  /** End of the day: lessons still without a lesson log */
  logs: { on: boolean; time: string };
  /** Before an approved special class */
  special: { on: boolean; minutes: number };
  /** Changes still waiting to be sent, a couple of hours after saving */
  unsynced: { on: boolean };
  /** Two days before the offline limit runs out */
  offlineLimit: { on: boolean };
  /** No reminders before / after these times */
  quietBefore: string;
  quietAfter: string;
}

export interface Prefs {
  theme: ThemeMode;
  reminders: ReminderPrefs;
}

export const DEFAULT_PREFS: Prefs = {
  theme: "system",
  reminders: {
    lessons: { on: true, minutes: 10 },
    register: { on: true, time: "07:20" },
    logs: { on: true, time: "15:30" },
    special: { on: true, minutes: 30 },
    unsynced: { on: true },
    offlineLimit: { on: true },
    quietBefore: "06:00",
    quietAfter: "20:00",
  },
};

const KEY = "monark.prefs";

function merge(saved: Partial<Prefs> | null): Prefs {
  if (!saved) return DEFAULT_PREFS;
  const r = (saved.reminders ?? {}) as Partial<ReminderPrefs>;
  return {
    theme: saved.theme ?? DEFAULT_PREFS.theme,
    reminders: {
      ...DEFAULT_PREFS.reminders,
      ...r,
      lessons: { ...DEFAULT_PREFS.reminders.lessons, ...(r.lessons ?? {}) },
      register: { ...DEFAULT_PREFS.reminders.register, ...(r.register ?? {}) },
      logs: { ...DEFAULT_PREFS.reminders.logs, ...(r.logs ?? {}) },
      special: { ...DEFAULT_PREFS.reminders.special, ...(r.special ?? {}) },
      unsynced: { ...DEFAULT_PREFS.reminders.unsynced, ...(r.unsynced ?? {}) },
      offlineLimit: { ...DEFAULT_PREFS.reminders.offlineLimit, ...(r.offlineLimit ?? {}) },
    },
  };
}

interface PrefsApi {
  prefs: Prefs;
  loaded: boolean;
  update: (patch: (p: Prefs) => Prefs) => void;
  /** "light" or "dark", after following the phone if needed */
  scheme: "light" | "dark";
}

const Ctx = createContext<PrefsApi | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const phone = useColorScheme();

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((raw) => setPrefs(merge(raw ? (JSON.parse(raw) as Partial<Prefs>) : null)))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: (p: Prefs) => Prefs) => {
    setPrefs((p) => {
      const next = patch(p);
      void SecureStore.setItemAsync(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const scheme: "light" | "dark" = prefs.theme === "system" ? (phone === "dark" ? "dark" : "light") : prefs.theme;
  // Swap the palette before anything below renders with it.
  if (colors.scheme !== scheme) applyPalette(scheme);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [scheme]);

  const value = useMemo(() => ({ prefs, loaded, update, scheme }), [prefs, loaded, update, scheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs outside PrefsProvider");
  return v;
}

/**
 * Switching light/dark re-draws the whole app (the screens are rebuilt), which brings it back to
 * Home; this sends the teacher back to the page they were on (Settings).
 */
let reopen: string | null = null;
export const reopenAfterThemeChange = (path: string) => {
  reopen = path;
};
export const takeReopen = () => {
  const p = reopen;
  reopen = null;
  return p;
};
