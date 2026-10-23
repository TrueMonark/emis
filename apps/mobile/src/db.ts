import * as SQLite from "expo-sqlite";

/**
 * The phone's own database (SQLite):
 * - `records`: the rows the server sent (one table for all kinds, `entity` says which), as JSON;
 * - `outbox`: changes made on the phone, waiting to be sent (each is one sync operation);
 * - `pending`: what those changes look like locally (a register mark, a mark), shown on screen
 *   over the server's rows until the server has answered;
 * - `meta`: the sync cursor, scope, calendar, settings, last sync time.
 */
export const db = SQLite.openDatabaseSync("monark-edu.db");

db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS records (
    entity TEXT NOT NULL,
    id TEXT NOT NULL,
    version INTEGER NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (entity, id)
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS outbox (
    opId TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    madeAt TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    result TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pending (
    key TEXT PRIMARY KEY,
    opId TEXT NOT NULL,
    value TEXT NOT NULL
  );
`);

export type Row = { id: string; version: number } & Record<string, unknown>;

/** All rows of one kind (optionally filtered in JS). */
export function all<T extends Row = Row>(entity: string, keep?: (r: T) => boolean): T[] {
  const rows = db.getAllSync<{ data: string }>("SELECT data FROM records WHERE entity = ?", [entity]);
  const parsed = rows.map((r) => JSON.parse(r.data) as T);
  return keep ? parsed.filter(keep) : parsed;
}

/** Rows of one kind where a field equals a value (uses SQLite's JSON functions). */
export function where<T extends Row = Row>(entity: string, field: string, value: string): T[] {
  const rows = db.getAllSync<{ data: string }>(
    `SELECT data FROM records WHERE entity = ? AND json_extract(data, '$.' || ?) = ?`,
    [entity, field, value]
  );
  return rows.map((r) => JSON.parse(r.data) as T);
}

export function one<T extends Row = Row>(entity: string, id: string): T | null {
  const row = db.getFirstSync<{ data: string }>("SELECT data FROM records WHERE entity = ? AND id = ?", [entity, id]);
  return row ? (JSON.parse(row.data) as T) : null;
}

export function putRecords(entity: string, rows: Row[]) {
  for (const r of rows) {
    db.runSync("INSERT OR REPLACE INTO records (entity, id, version, data) VALUES (?, ?, ?, ?)", [entity, r.id, r.version ?? 0, JSON.stringify(r)]);
  }
}

export function deleteRecord(entity: string, id: string) {
  db.runSync("DELETE FROM records WHERE entity = ? AND id = ?", [entity, id]);
}

// ── meta ──────────────────────────────────────────────────────────────────

export function getMeta<T = string>(key: string): T | null {
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function setMeta(key: string, value: unknown) {
  db.runSync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
}

// ── outbox & pending ──────────────────────────────────────────────────────

export type OutboxStatus = "pending" | "applied" | "rejected";
export interface OutboxItem {
  opId: string;
  type: string;
  payload: unknown;
  madeAt: string;
  label: string;
  status: OutboxStatus;
  error: string | null;
  result: unknown;
  createdAt: string;
  updatedAt: string;
}

export function outbox(status?: OutboxStatus): OutboxItem[] {
  const rows = db.getAllSync<Record<string, string | null>>(
    status ? "SELECT * FROM outbox WHERE status = ? ORDER BY createdAt" : "SELECT * FROM outbox ORDER BY createdAt DESC",
    status ? [status] : []
  );
  return rows.map((r) => ({
    opId: r.opId!,
    type: r.type!,
    payload: JSON.parse(r.payload!),
    madeAt: r.madeAt!,
    label: r.label!,
    status: r.status as OutboxStatus,
    error: r.error,
    result: r.result ? JSON.parse(r.result) : null,
    createdAt: r.createdAt!,
    updatedAt: r.updatedAt!,
  }));
}

export const pendingCount = () =>
  db.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'")?.n ?? 0;

/** Adds a change to the outbox, with how it looks locally (`pending` rows by key). */
export function enqueue(op: { opId: string; type: string; payload: unknown; madeAt: string; label: string }, local: { key: string; value: unknown }[]) {
  const now = new Date().toISOString();
  db.withTransactionSync(() => {
    db.runSync(
      "INSERT INTO outbox (opId, type, payload, madeAt, label, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
      [op.opId, op.type, JSON.stringify(op.payload), op.madeAt, op.label, now, now]
    );
    for (const l of local) {
      db.runSync("INSERT OR REPLACE INTO pending (key, opId, value) VALUES (?, ?, ?)", [l.key, op.opId, JSON.stringify(l.value)]);
    }
  });
}

/** The server answered: record it, and stop showing that change's local values. */
export function finishOp(opId: string, status: "applied" | "rejected", error: string | null, result: unknown) {
  db.withTransactionSync(() => {
    db.runSync("UPDATE outbox SET status = ?, error = ?, result = ?, updatedAt = ? WHERE opId = ?", [
      status,
      error,
      result == null ? null : JSON.stringify(result),
      new Date().toISOString(),
      opId,
    ]);
    db.runSync("DELETE FROM pending WHERE opId = ?", [opId]);
  });
}

/** Local values whose key starts with a prefix. */
export function pendingWithPrefix<T = unknown>(prefix: string): Map<string, T> {
  const rows = db.getAllSync<{ key: string; value: string }>("SELECT key, value FROM pending WHERE key LIKE ? ESCAPE '\\'", [
    prefix.replace(/[\\%_]/g, (c) => `\\${c}`) + "%",
  ]);
  return new Map(rows.map((r) => [r.key, JSON.parse(r.value) as T]));
}

/** Keep the answered list short: drop applied changes older than two weeks. */
export function pruneOutbox() {
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
  db.runSync("DELETE FROM outbox WHERE status = 'applied' AND updatedAt < ?", [cutoff]);
}

/** Replace every server row (a new snapshot). Local changes waiting to be sent are kept. */
export function replaceAll(data: Record<string, Row[]>) {
  db.withTransactionSync(() => {
    db.runSync("DELETE FROM records");
    for (const [entity, rows] of Object.entries(data)) putRecords(entity, rows);
  });
}

/** Everything (signing out, or a different teacher signing in on this phone). */
export function wipeAll() {
  db.execSync("DELETE FROM records; DELETE FROM meta; DELETE FROM outbox; DELETE FROM pending;");
}
