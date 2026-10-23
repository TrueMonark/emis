import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useDataVersion } from "./events";
import { usePrefs, type ReminderPrefs } from "./prefs";
import { addDays, dayKeyOf, todayIso } from "./dates";
import {
  classLabel,
  learnersOf,
  lessonLog,
  myRegisterClasses,
  mySlots,
  mySpecialClasses,
  noSchoolReason,
  registerMarks,
  subjectName,
} from "./queries";
import { lastSyncAt, offlineDays, pendingCount } from "./sync";

/**
 * Reminders on the phone (local notifications: they work offline, nothing goes through a server).
 *
 * Worked out from the phone's own timetable and registers for the next 7 days and set again
 * whenever the data or the settings change, or the app comes back to the front. Nothing on
 * weekends, public holidays or closure days, and nothing in the quiet hours. Each one opens the
 * right page when tapped.
 */

const CHANNEL = "reminders";
const handled = new Set<string>();
const DAYS_AHEAD = 7;
// iOS keeps at most 64 waiting notifications per app.
const MAX = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

interface Planned {
  at: Date;
  title: string;
  body: string;
  url: string;
}

const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const at = (day: string, time: string, minusMinutes = 0) => new Date(new Date(`${day}T${time}:00`).getTime() - minusMinutes * 60_000);

/** What to remind the teacher about (pure: reads the phone's data, schedules nothing). */
export function planReminders(r: ReminderPrefs, now = new Date()): Planned[] {
  const out: Planned[] = [];
  const today = todayIso(now);
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = addDays(today, i);
    if (noSchoolReason(day)) continue;
    const slots = mySlots(dayKeyOf(day));

    if (r.lessons.on) {
      for (const s of slots) {
        out.push({
          at: at(day, s.startTime, r.lessons.minutes),
          title: `Next lesson in ${r.lessons.minutes} min`,
          body: `${subjectName(s.subjectId)} · ${classLabel(s.classId)} at ${s.startTime}${s.roomNumber ? ` (${s.roomNumber})` : ""}`,
          url: `/register/period?slotId=${encodeURIComponent(s.id)}&day=${day}`,
        });
      }
    }

    if (r.register.on) {
      for (const c of myRegisterClasses(day)) {
        // Today: only if the register isn't complete yet.
        if (day === today && registerMarks(c.classId, day, null).size >= learnersOf(c.classId).length) continue;
        out.push({
          at: at(day, r.register.time),
          title: "Daily register",
          body: `Take the register for ${c.label}${c.cover ? " (you're covering it)" : ""}`,
          url: `/register/daily?classId=${encodeURIComponent(c.classId)}&day=${day}`,
        });
      }
    }

    if (r.logs.on && slots.length > 0) {
      const missing = day === today ? slots.filter((s) => !lessonLog(s.id, day)).length : slots.length;
      if (missing > 0) {
        out.push({
          at: at(day, r.logs.time),
          title: "Lesson logs",
          body: `Log what you taught today (${missing} lesson${missing === 1 ? "" : "s"})`,
          url: "/timetable",
        });
      }
    }
  }

  if (r.special.on) {
    for (const sc of mySpecialClasses()) {
      if (sc.status !== "APPROVED") continue;
      out.push({
        at: at(sc.date.slice(0, 10), sc.startTime, r.special.minutes),
        title: `Special class in ${r.special.minutes} min`,
        body: `${sc.topic} · ${classLabel(sc.classId)} at ${sc.startTime}`,
        url: `/register/special?id=${encodeURIComponent(sc.id)}`,
      });
    }
  }

  const waiting = pendingCount();
  if (r.unsynced.on && waiting > 0) {
    out.push({
      at: new Date(now.getTime() + 2 * 3_600_000),
      title: "Not sent yet",
      body: `${waiting} change${waiting === 1 ? "" : "s"} on this phone still waiting to sync. Connect to the internet to send them.`,
      url: "/sync",
    });
  }

  const last = lastSyncAt();
  if (r.offlineLimit.on && last) {
    const limit = new Date(new Date(last).getTime() + offlineDays() * 86_400_000);
    const warn = new Date(limit.getTime() - 2 * 86_400_000);
    warn.setHours(9, 0, 0, 0);
    out.push({
      at: warn,
      title: "Sync soon",
      body: "This phone hasn't synced for a while. Connect once in the next two days to keep saving registers and marks.",
      url: "/sync",
    });
  }

  return out
    .filter((p) => p.at.getTime() > now.getTime() + 30_000)
    .filter((p) => hm(p.at) >= r.quietBefore && hm(p.at) <= r.quietAfter)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX);
}

/**
 * Our own Android channel ("Reminders"). Expo Go on Android can't create channels (it fails
 * with "NotificationsChannelsProvider" null), so there the reminders use Expo Go's default
 * channel instead; our own app builds get the "Reminders" channel.
 */
let channelReady = false;
async function ensureChannel() {
  if (Platform.OS !== "android" || channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Reminders", importance: Notifications.AndroidImportance.HIGH });
    channelReady = true;
  } catch {
    channelReady = false;
  }
}
const channel = () => (channelReady ? { channelId: CHANNEL } : {});

/** Asks once for permission to show notifications. */
export async function ensurePermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function permissionGranted(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function reschedule(r: ReminderPrefs): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const plan = planReminders(r);
  if (plan.length === 0 || !(await permissionGranted())) return 0;
  for (const p of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, data: { url: p.url }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, ...channel() },
    });
  }
  return plan.length;
}

export const cancelAllReminders = () => Notifications.cancelAllScheduledNotificationsAsync();

export async function sendTestReminder() {
  if (!(await ensurePermission())) throw new Error("Notifications are off for this app in the phone's settings.");
  await Notifications.scheduleNotificationAsync({
    content: { title: "Monark Edu", body: "Reminders are working. This is what they'll look like.", data: { url: "/settings" }, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, ...channel() },
  });
}

/** Keeps the reminders up to date while the teacher is signed in, and opens the page of a tapped one. */
export function useReminders() {
  const { prefs } = usePrefs();
  const version = useDataVersion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          if (!asked.current) {
            asked.current = true;
            await ensurePermission();
          }
          await reschedule(prefs.reminders);
        } catch {
          // Reminders are a help, never a reason for the app to fail.
        }
      }, 2_000);
    };
    schedule();
    const sub = AppState.addEventListener("change", (s) => s === "active" && schedule());
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [prefs.reminders, version]);

  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const id = last?.notification.request.identifier;
    const url = last?.notification.request.content.data?.url;
    if (!id || handled.has(id) || typeof url !== "string") return;
    handled.add(id); // once only, even when the app is re-drawn (light/dark)
    setTimeout(() => router.push(url as never), 0);
  }, [last]);
}
