"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@school/ui/components/card";
import { Badge } from "@school/ui/components/badge";
import { Skeleton } from "@school/ui/components/skeleton";
import { api } from "@/lib/api-client";

interface AuditLine {
  id: string;
  at: string;
  action: string;
  summary: string;
  actorUserId: string | null;
  actorName: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  OFFICE_CREATED: "Office added",
  OFFICE_UPDATED: "Office changed",
  ACCOUNT_CREATED: "Account created",
  MEMBERSHIP_ENDED: "Role ended",
  SCHOOL_CREATED: "School registered",
  SCHOOL_UPDATED: "School changed",
  SCHOOL_MOVED: "School moved",
  SETUP_COMPLETED: "Setup finished",
  PASSWORD_RESET: "Password reset",
  PASSWORD_RESET_DECLINED: "Reset turned down",
  TRANSFER_REQUESTED: "Transfer asked",
  TRANSFER_CONFIRMED: "Transfer confirmed",
  TRANSFER_DECLINED: "Transfer turned down",
  TRANSFER_CANCELLED: "Transfer withdrawn",
  STAFF_JOINED: "Joined a school",
};

/** Who did what in this office's area (newest first). Lines are never changed or deleted. */
export default function OfficeAuditPage() {
  const [lines, setLines] = useState<AuditLine[] | null>(null);

  useEffect(() => {
    api.get<{ data: AuditLine[] }>("/office/audit").then((r) => setLines(r.data ?? [])).catch(() => setLines([]));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Schools and accounts created, setups finished, EMIS numbers changed, password resets and transfers — the latest 200.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {!lines ? (
            <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : lines.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {lines.map((l) => (
                <li key={l.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-36 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {new Date(l.at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <Badge variant="secondary" className="w-fit">{ACTION_LABEL[l.action] ?? l.action}</Badge>
                  <span className="text-sm flex-1">{l.summary}</span>
                  <span className="text-xs text-muted-foreground">{l.actorName ?? "system"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
