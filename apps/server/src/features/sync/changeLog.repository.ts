import prisma from "@/lib/db/prisma";

/** One line of the change log (Phase 3c). */
export interface ChangeRow {
  seq: bigint;
  entity: string;
  entityId: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  txid: bigint;
  changedAt: Date;
  changedBy: string | null;
}

/**
 * Position in the change log: everything up to and including (txid, seq) has been delivered.
 * Built on transaction ids, not on seq alone (see `changesSince`).
 */
export interface ChangeCursor {
  txid: bigint;
  seq: bigint;
}

const MAX_SEQ = BigInt("9223372036854775807");

/**
 * Reads the change log the database triggers write (migration 20261016150000_phase3c_change_log).
 * Row-level security limits every read to the current school.
 */
export class ChangeLogRepository {
  /**
   * Oldest transaction still running. Every transaction below it has finished, so all of their
   * log lines are visible now and no more can appear.
   */
  async currentHorizon(): Promise<bigint> {
    const rows = await prisma.$queryRaw<{ xmin: bigint }[]>`
      SELECT pg_snapshot_xmin(pg_current_snapshot())::text::bigint AS xmin`;
    return BigInt(rows[0].xmin);
  }

  /**
   * Changes after `cursor`, oldest first, but only from transactions below the horizon.
   *
   * Why not just "seq > n": sequence numbers are taken when a row is written, not when its
   * transaction commits. A long transaction can take seq 10, commit after another one that took
   * seq 11, and a "seq > 11" cursor would skip it forever. Serving only finished transactions
   * (txid below the oldest running one) and ordering by (txid, seq) means nothing can still be
   * added behind the cursor.
   */
  async changesSince(cursor: ChangeCursor | null, limit: number) {
    const horizon = await this.currentHorizon();
    const after = cursor ?? { txid: BigInt(-1), seq: MAX_SEQ };
    const rows = await prisma.$queryRaw<ChangeRow[]>`
      SELECT "seq", "entity", "entityId", "op", "txid", "changedAt", "changedBy"
      FROM "change_log"
      WHERE "txid" < ${horizon}
        AND ("txid", "seq") > (${after.txid}, ${after.seq})
      ORDER BY "txid", "seq"
      LIMIT ${limit + 1}`;

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    // A full page continues right after its last line; otherwise everything below the horizon
    // has been delivered, so the next pull starts at the horizon.
    const next: ChangeCursor = hasMore
      ? { txid: BigInt(last.txid), seq: BigInt(last.seq) }
      : maxCursor(after, { txid: horizon - BigInt(1), seq: MAX_SEQ });
    return { changes: page, next, hasMore };
  }

  /** Where a phone that has just downloaded everything should start. */
  async cursorNow(): Promise<ChangeCursor> {
    const horizon = await this.currentHorizon();
    return { txid: horizon - BigInt(1), seq: MAX_SEQ };
  }
}

function maxCursor(a: ChangeCursor, b: ChangeCursor): ChangeCursor {
  if (a.txid !== b.txid) return a.txid > b.txid ? a : b;
  return a.seq >= b.seq ? a : b;
}

/** Cursors travel as text ("<txid>.<seq>") so phones can store them as they are. */
export function encodeCursor(c: ChangeCursor): string {
  return `${c.txid.toString()}.${c.seq.toString()}`;
}

export function decodeCursor(text: string | null | undefined): ChangeCursor | null {
  if (!text) return null;
  const m = /^(-?\d{1,20})\.(\d{1,20})$/.exec(text.trim());
  if (!m) return null;
  return { txid: BigInt(m[1]), seq: BigInt(m[2]) };
}

export const changeLogRepository = new ChangeLogRepository();
