import {
  changeLogRepository,
  decodeCursor,
  encodeCursor,
  type ChangeRow,
} from "./changeLog.repository";
import { SYNC_ENTITIES, teacherScopeService, type SyncEntity, type TeacherScope } from "./teacherScope.service";
import type { Role } from "@prisma/client";
import { z } from "zod";
import { ForbiddenError } from "@/lib/http/errors";
import { logger } from "@/lib/logger/logger";
import { getErrorMessage } from "@school/shared/format";
import { syncRecordsRepository, type SyncRecord } from "./syncRecords.repository";
import { syncOperationRepository } from "./syncOperation.repository";
import { OPERATION_TYPES, OperationRejected, runOperation } from "./sync.operations";
import { currentTenant, runWithTenant } from "@/lib/db/tenant";
import { calendarService } from "@/features/calendar/calendar.service";

/** How many days a phone may work offline before it must connect once (a national setting). */
export function offlineDays(): number {
  const n = Number(process.env.SYNC_OFFLINE_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 14;
}

export const MAX_OPERATIONS_PER_PUSH = 100;

export const pushSchema = z.object({
  deviceId: z.string().trim().min(1).max(100).optional(),
  operations: z
    .array(
      z.object({
        /** The phone's own id for this operation (a UUID); a resend uses the same id */
        opId: z.string().trim().min(8).max(100),
        type: z.string().min(1).max(50),
        payload: z.unknown(),
        /** When the change was made on the phone (ISO time) */
        madeAt: z.string().datetime({ offset: true }).optional(),
      })
    )
    .min(1, "Send at least one operation")
    .max(MAX_OPERATIONS_PER_PUSH, `At most ${MAX_OPERATIONS_PER_PUSH} operations per push`),
});
export type PushInput = z.infer<typeof pushSchema>;

export interface OperationResult {
  opId: string;
  status: "applied" | "rejected" | "in_progress";
  /** true when this opId had been received before (the first answer is returned again) */
  duplicate?: boolean;
  error?: string;
  result?: unknown;
}

export interface ChangeOut {
  entity: SyncEntity;
  id: string;
  op: "UPSERT" | "DELETE";
  /** The phone's fields of the row (for UPSERT) */
  record?: SyncRecord;
}

const SYNCED = new Set<string>(SYNC_ENTITIES);

export interface ScopedChange {
  entity: SyncEntity;
  entityId: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  changedAt: Date;
}

/**
 * The building blocks of phone sync (Phase 3c). The pull and push endpoints come in Phase 5; this
 * is what they will call: "what changed for this teacher since this cursor?".
 */
export class SyncService {
  /**
   * Changes in the teacher's scope since `cursorText`, plus the cursor to send next time.
   * Inserts and updates are limited to records in scope. Deletes are passed on for every synced
   * table: the record is gone, so its scope can't be checked, and the phone simply ignores ids it
   * doesn't hold (an id reveals nothing).
   */
  async changesForTeacher(userId: string, cursorText: string | null, limit = 500) {
    const scope = await teacherScopeService.forUser(userId);
    const { changes, next, hasMore } = await changeLogRepository.changesSince(
      decodeCursor(cursorText),
      limit
    );
    return {
      changes: filterToScope(changes, scope),
      cursor: encodeCursor(next),
      hasMore,
    };
  }

  /** Cursor for a phone that has just downloaded its whole scope. */
  async startingCursor(): Promise<string> {
    return encodeCursor(await changeLogRepository.cursorNow());
  }
}

/**
 * Phone sync for teachers (Phase 5, design §7). Three calls:
 *  - snapshot: everything in the teacher's scope, plus a cursor and the scope fingerprint;
 *  - changes:  what changed since the cursor, with the rows' current fields; if the scope itself
 *    changed (a new class, cover, term…) the phone is told to take a new snapshot;
 *  - push:     the phone's queued operations, each applied once (by its id) through the same
 *    services as the web, with per-type conflict rules; every rejection comes back with the reason.
 */
export class PhoneSyncService {
  private async me(userId: string) {
    const teacher = await syncOperationRepository.findTeacherProfileId(userId);
    if (!teacher) throw new ForbiddenError("Phone sync is for teaching staff (this account has no teacher profile)");
    return teacher;
  }

  async snapshot(userId: string) {
    const teacher = await this.me(userId);
    // The cursor is taken first: anything that changes while the rows are read is sent again by
    // the next pull (the phone simply overwrites it), so nothing falls in between.
    const cursor = await syncService.startingCursor();
    const scope = await teacherScopeService.forTeacher(teacher.id);
    const data = {} as Record<SyncEntity, SyncRecord[]>;
    for (const entity of SYNC_ENTITIES) {
      data[entity] = await syncRecordsRepository.findByIds(entity, [...scope.ids[entity]]);
    }
    return {
      cursor,
      scope: scope.fingerprint,
      serverTime: new Date().toISOString(),
      settings: { offlineDays: offlineDays() },
      me: { userId, teacherProfileId: teacher.id, name: `${teacher.firstName} ${teacher.lastName}` },
      calendar: await this.calendar(),
      data,
    };
  }

  async changes(userId: string, cursorText: string | null, scopeFingerprint: string | null, limit = 500) {
    const teacher = await this.me(userId);
    if (!decodeCursor(cursorText)) {
      return { resyncRequired: true as const, reason: "No valid cursor: take a snapshot first" };
    }
    const scope = await teacherScopeService.forTeacher(teacher.id);
    if (scopeFingerprint !== scope.fingerprint) {
      return { resyncRequired: true as const, reason: "Your classes or term changed: take a new snapshot" };
    }
    const page = await changeLogRepository.changesSince(decodeCursor(cursorText), Math.min(Math.max(limit, 1), 2000));
    const scoped = filterToScope(page.changes, scope);

    // One entry per row: its last change in this page wins.
    const last = new Map<string, ScopedChange>();
    for (const c of scoped) {
      last.delete(`${c.entity}:${c.entityId}`);
      last.set(`${c.entity}:${c.entityId}`, c);
    }
    const upserts = new Map<SyncEntity, Set<string>>();
    for (const c of last.values()) if (c.op !== "DELETE") (upserts.get(c.entity) ?? upserts.set(c.entity, new Set()).get(c.entity)!).add(c.entityId);

    const records = new Map<string, SyncRecord>();
    for (const [entity, idSet] of upserts) {
      for (const r of await syncRecordsRepository.findByIds(entity, [...idSet])) records.set(`${entity}:${r.id}`, r);
    }

    // A row can come into scope without changing itself: a learner newly enrolled in the class
    // (the enrolment changes, the learner doesn't). Send what such rows point at, too.
    const extra: ChangeOut[] = [];
    const wanted = new Set<string>();
    const want = (entity: SyncEntity, id: unknown) => {
      const key = `${entity}:${id}`;
      if (typeof id !== "string" || !scope.ids[entity].has(id) || records.has(key) || wanted.has(key)) return;
      wanted.add(key);
      extra.push({ entity, id, op: "UPSERT" });
    };
    for (const [key, r] of records) {
      const entity = key.split(":")[0] as SyncEntity;
      if (entity === "student_class_enrollments") want("students", r.studentId);
      if (entity === "class_subjects" || entity === "assessments" || entity === "timetable_slots" || entity === "special_classes") {
        want("subjects", r.subjectId);
      }
    }
    for (const e of extra) {
      const [row] = await syncRecordsRepository.findByIds(e.entity, [e.id]);
      if (row) records.set(`${e.entity}:${e.id}`, row);
    }

    const changes: ChangeOut[] = [];
    for (const c of last.values()) {
      if (c.op === "DELETE") {
        changes.push({ entity: c.entity, id: c.entityId, op: "DELETE" });
        continue;
      }
      const record = records.get(`${c.entity}:${c.entityId}`);
      // Gone since it was logged: its DELETE line comes in a later page.
      if (record) changes.push({ entity: c.entity, id: c.entityId, op: "UPSERT", record });
    }
    for (const e of extra) {
      const record = records.get(`${e.entity}:${e.id}`);
      if (record) changes.unshift({ ...e, record });
    }
    return {
      resyncRequired: false as const,
      changes,
      cursor: encodeCursor(page.next),
      hasMore: page.hasMore,
      scope: scope.fingerprint,
      calendar: await this.calendar(),
    };
  }

  /**
   * Public holidays and closure days from a month back to four months ahead (Phase 5b), sent
   * whole with every snapshot and pull, so the phone can refuse registers on those days
   * offline. Weekends aren't listed (the phone knows those).
   */
  private async calendar() {
    const today = new Date();
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 31));
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 122));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), nonSchoolDays: await calendarService.nonSchoolDays(from, to) };
  }

  /**
   * Apply the phone's operations in order. Each is applied at most once: a resend with the same
   * opId gets the stored answer. One failing operation doesn't stop the others.
   */
  async push(userId: string, role: Role, input: PushInput): Promise<{ results: OperationResult[] }> {
    const teacher = await this.me(userId);
    const now = new Date();
    const results: OperationResult[] = [];
    for (const op of input.operations) {
      if (!(OPERATION_TYPES as readonly string[]).includes(op.type)) {
        results.push({ opId: op.opId, status: "rejected", error: `Unknown operation "${op.type}"` });
        continue;
      }
      const claimed = await syncOperationRepository.claim({ userId, opId: op.opId, type: op.type, deviceId: input.deviceId ?? null });
      if (!claimed) {
        const seen = await syncOperationRepository.find(userId, op.opId);
        if (!seen || seen.status === "PROCESSING") {
          results.push({ opId: op.opId, status: "in_progress", duplicate: true });
        } else {
          const stored = (seen.response ?? {}) as { status?: OperationResult["status"]; error?: string; result?: unknown };
          results.push({ opId: op.opId, duplicate: true, status: stored.status ?? "applied", error: stored.error, result: stored.result });
        }
        continue;
      }

      const madeAtRaw = op.madeAt ? new Date(op.madeAt) : now;
      const madeAt = madeAtRaw > now ? now : madeAtRaw; // a phone clock ahead of time can't win conflicts
      try {
        // Marked as coming from the phone, for the marks history.
        const result = await runWithTenant({ ...currentTenant(), source: "PHONE" }, () =>
          runOperation(op.type as (typeof OPERATION_TYPES)[number], op.payload, {
            userId,
            role,
            teacherProfileId: teacher.id,
            madeAt,
          })
        );
        await syncOperationRepository.finish(claimed.id, "APPLIED", { status: "applied", result });
        results.push({ opId: op.opId, status: "applied", result });
      } catch (error) {
        const message = getErrorMessage(error, "The operation failed");
        const known = error instanceof OperationRejected || (error as { name?: string })?.name?.endsWith("Error");
        if (!known) logger.error("Sync operation failed", error instanceof Error ? error : undefined, { opId: op.opId, type: op.type });
        await syncOperationRepository.finish(claimed.id, "REJECTED", { status: "rejected", error: message });
        results.push({ opId: op.opId, status: "rejected", error: message });
      }
    }
    return { results };
  }
}

export function filterToScope(changes: ChangeRow[], scope: TeacherScope): ScopedChange[] {
  const out: ScopedChange[] = [];
  for (const c of changes) {
    if (!SYNCED.has(c.entity)) continue;
    const entity = c.entity as SyncEntity;
    if (c.op !== "DELETE" && !scope.ids[entity].has(c.entityId)) continue;
    out.push({ entity, entityId: c.entityId, op: c.op, changedAt: c.changedAt });
  }
  return out;
}

export const syncService = new SyncService();
export const phoneSyncService = new PhoneSyncService();
