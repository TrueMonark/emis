import { useSyncExternalStore } from "react";
import { ApiError, call } from "./api";
import { deleteRecord, finishOp, getMeta, outbox, pendingCount, pruneOutbox, putRecords, replaceAll, setMeta, type Row } from "./db";
import { notifyDataChanged } from "./events";
import { deviceId, type Session } from "./storage";

/**
 * Syncing with the server (Phase 6, API in docs/design/sync-api.md):
 * 1. send the changes waiting in the outbox (each applied once by the server, by its opId);
 * 2. fetch what changed since the last cursor, or a fresh snapshot when told to (or the first
 *    time).
 * One sync at a time. Runs on start, when the phone comes back online, after every save, and
 * from "Sync now".
 */

export interface NonSchoolDay {
  date: string;
  kind: "PUBLIC_HOLIDAY" | "SCHOOL_CLOSURE";
  name: string;
}

/** An announcement from the offices (Phase 9c); kept whole on the phone, replaced on every sync. */
export interface PhoneAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: "LEADERS" | "ALL_STAFF";
  requiresAck: boolean;
  office: { name: string; type: "HQ" | "PROVINCIAL" | "DISTRICT" };
  publishedAt: string;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  attachments: { fileName: string; sizeBytes: number }[];
  readAt: string | null;
  schoolAcknowledged: { at: string; by: string | null } | null;
  canAcknowledge: boolean;
}

interface Snapshot {
  cursor: string;
  scope: string;
  serverTime: string;
  settings: { offlineDays: number };
  me: { userId: string; teacherProfileId: string; name: string };
  calendar?: { from: string; to: string; nonSchoolDays: NonSchoolDay[] };
  announcements?: PhoneAnnouncement[];
  data: Record<string, Row[]>;
}
type Changes =
  | { resyncRequired: true; reason: string }
  | {
      resyncRequired: false;
      cursor: string;
      scope: string;
      hasMore: boolean;
      changes: { entity: string; id: string; op: "UPSERT" | "DELETE"; record?: Row }[];
      calendar?: { from: string; to: string; nonSchoolDays: NonSchoolDay[] };
      announcements?: PhoneAnnouncement[];
    };
interface PushAnswer {
  results: { opId: string; status: "applied" | "rejected" | "in_progress"; duplicate?: boolean; error?: string; result?: unknown }[];
}

// ── state shown on screen ──────────────────────────────────────────────────

export interface SyncState {
  syncing: boolean;
  lastError: string | null;
  /** The account can't sync any more (deactivated, left the school, not a teacher) */
  blocked: string | null;
  passwordChangeRequired: boolean;
}

let state: SyncState = { syncing: false, lastError: null, blocked: null, passwordChangeRequired: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const useSyncState = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );

export const getSyncState = () => state;
export const lastSyncAt = () => getMeta<string>("lastSyncAt");
export const offlineDays = () => getMeta<number>("offlineDays") ?? 14;
export const me = () => getMeta<Snapshot["me"]>("me");
export const nonSchoolDays = () => getMeta<NonSchoolDay[]>("calendar") ?? [];
export const storedAnnouncements = () => getMeta<PhoneAnnouncement[]>("announcements") ?? [];

/** True once the app has been offline longer than the school allows: it must sync once. */
export function mustGoOnline(now = Date.now()): boolean {
  const last = lastSyncAt();
  if (!last) return true;
  return now - new Date(last).getTime() > offlineDays() * 86_400_000;
}

// ── the sync itself ────────────────────────────────────────────────────────

let running: Promise<void> | null = null;

export function syncNow(session: Session): Promise<void> {
  if (!running) {
    running = doSync(session).finally(() => {
      running = null;
    });
  }
  return running;
}

async function doSync(session: Session) {
  set({ syncing: true, lastError: null });
  try {
    await push(session);
    await pull(session);
    setMeta("lastSyncAt", new Date().toISOString());
    pruneOutbox();
    set({ blocked: null, passwordChangeRequired: false });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "PASSWORD_CHANGE_REQUIRED") set({ passwordChangeRequired: true });
      else if (error.status === 401 || error.status === 403) set({ blocked: error.message });
      set({ lastError: error.message });
    } else {
      set({ lastError: error instanceof Error ? error.message : "Sync failed" });
    }
  } finally {
    notifyDataChanged();
    set({ syncing: false });
  }
}

async function push(session: Session) {
  const waiting = outbox("pending");
  if (waiting.length === 0) return;
  const device = await deviceId();
  for (let i = 0; i < waiting.length; i += 100) {
    const batch = waiting.slice(i, i + 100);
    const answer = await call<PushAnswer>(session, "/sync/push", {
      method: "POST",
      body: { deviceId: device, operations: batch.map((o) => ({ opId: o.opId, type: o.type, payload: o.payload, madeAt: o.madeAt })) },
      timeoutMs: 60_000,
    });
    for (const r of answer.results) {
      if (r.status === "in_progress") continue; // sent again next time
      finishOp(r.opId, r.status, r.error ?? null, r.result ?? null);
    }
  }
}

function saveCalendar(calendar: Snapshot["calendar"]) {
  if (calendar) setMeta("calendar", calendar.nonSchoolDays);
}

function saveAnnouncements(list: Snapshot["announcements"]) {
  if (list) setMeta("announcements", list);
}

async function snapshot(session: Session) {
  const snap = await call<Snapshot>(session, "/sync/snapshot", { timeoutMs: 120_000 });
  replaceAll(snap.data);
  setMeta("cursor", snap.cursor);
  setMeta("scope", snap.scope);
  setMeta("me", snap.me);
  setMeta("offlineDays", snap.settings.offlineDays);
  saveCalendar(snap.calendar);
  saveAnnouncements(snap.announcements);
}

async function pull(session: Session) {
  const cursor = getMeta<string>("cursor");
  const scope = getMeta<string>("scope");
  if (!cursor || !scope) return snapshot(session);
  let next = cursor;
  for (let page = 0; page < 50; page++) {
    const res = await call<Changes>(
      session,
      `/sync/changes?cursor=${encodeURIComponent(next)}&scope=${encodeURIComponent(scope)}&limit=1000`,
      { timeoutMs: 60_000 }
    );
    if (res.resyncRequired) return snapshot(session);
    for (const c of res.changes) {
      if (c.op === "DELETE") deleteRecord(c.entity, c.id);
      else if (c.record) putRecords(c.entity, [c.record]);
    }
    saveCalendar(res.calendar);
    saveAnnouncements(res.announcements);
    next = res.cursor;
    setMeta("cursor", next); // only after the page is applied
    if (!res.hasMore) return;
  }
}

export { pendingCount };
