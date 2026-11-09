import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { currentTenant } from "@/lib/db/tenant";
import { logger } from "@/lib/logger/logger";

export type AuditAction =
  | "OFFICE_CREATED"
  | "OFFICE_UPDATED"
  | "ACCOUNT_CREATED"
  | "MEMBERSHIP_ENDED"
  | "SCHOOL_CREATED"
  | "SCHOOL_UPDATED"
  | "SCHOOL_MOVED"
  | "SETUP_COMPLETED"
  | "PASSWORD_RESET"
  | "PASSWORD_RESET_DECLINED"
  | "TRANSFER_REQUESTED"
  | "TRANSFER_CONFIRMED"
  | "TRANSFER_DECLINED"
  | "TRANSFER_CANCELLED"
  | "STAFF_JOINED"
  | "SCHOOL_CLOSURE_ADDED"
  | "SCHOOL_CLOSURE_REMOVED"
  | "PUBLIC_HOLIDAY_ADDED"
  | "PUBLIC_HOLIDAY_CANCELLED"
  | "PUBLIC_HOLIDAY_CHANGE_REMOVED"
  | "FEE_CREATED"
  | "FEE_UPDATED"
  | "FEE_DISCOUNT"
  | "PAYMENT_RECORDED"
  | "PAYMENT_VOIDED"
  | "FACILITIES_UPDATED"
  | "RETURN_ROUND_OPENED"
  | "RETURN_ROUND_CLOSED"
  | "RETURN_ROUND_REOPENED"
  | "RETURN_SUBMITTED"
  | "RETURN_APPROVED"
  | "RETURN_SENT_BACK"
  | "RETURN_REOPENED"
  | "ANNOUNCEMENT_POSTED"
  | "ANNOUNCEMENT_WITHDRAWN";

export interface AuditEntry {
  action: AuditAction;
  targetType: "OFFICE" | "ACCOUNT" | "SCHOOL";
  targetId?: string | null;
  schoolId?: string | null;
  officeId?: string | null;
  summary: string;
  details?: Prisma.InputJsonValue;
  /** Defaults to the signed-in person */
  actorUserId?: string | null;
}

/**
 * The audit log: who did what, above the school or about accounts. Lines are only ever added
 * (the database refuses changes and deletions by the app).
 */
export class AuditService {
  async record(entry: AuditEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          schoolId: entry.schoolId ?? null,
          officeId: entry.officeId ?? null,
          summary: entry.summary,
          details: entry.details,
          actorUserId: entry.actorUserId ?? currentTenant().userId,
        },
      });
    } catch (error) {
      // The action itself has happened; a missing log line must be visible in the server log.
      logger.error("Audit log write failed", error instanceof Error ? error : undefined, {
        action: entry.action,
        targetId: entry.targetId ?? undefined,
      });
    }
  }

  /** Lines about these offices or these schools, newest first. */
  async list(scope: { officeIds: string[] | "ALL"; schoolIds: string[] | "ALL" }, take = 200) {
    const where: Prisma.AuditLogWhereInput =
      scope.officeIds === "ALL"
        ? {}
        : {
            OR: [
              { officeId: { in: scope.officeIds } },
              ...(scope.schoolIds === "ALL" ? [] : [{ schoolId: { in: scope.schoolIds } }]),
            ],
          };
    const lines = await prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, take });
    const actorIds = [...new Set(lines.map((l) => l.actorUserId).filter((x): x is string => !!x))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, email: true, displayName: true },
    });
    const byId = new Map(actors.map((a) => [a.id, a.displayName || a.email]));
    return lines.map((l) => ({ ...l, actorName: l.actorUserId ? byId.get(l.actorUserId) ?? null : null }));
  }
}

export const auditService = new AuditService();
