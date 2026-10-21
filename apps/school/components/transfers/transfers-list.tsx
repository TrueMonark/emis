"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@school/ui/components/alert-dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";

export interface TransferRow {
  id: string;
  userId: string;
  name: string;
  staffNumber: string | null;
  role: string;
  requestedAt: string | null;
  requestedBy: string | null;
  toSchool: { id: string; name: string };
  fromSchool: { id: string; name: string } | null;
  /** On a school's page: "in" (joining us) or "out" (leaving us); null on office pages */
  direction: "in" | "out" | null;
  /** Whether you may confirm / turn it down */
  canDecide: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  HEAD_TEACHER: "head teacher",
  DEPUTY_HEAD: "deputy head",
  TEACHER: "teacher",
  CLERK: "clerk",
};

type Action = "confirm" | "decline" | "cancel";

/**
 * Transfers waiting for confirmation. On the Teachers page: people joining (we can withdraw) and
 * people leaving (we confirm or turn down). On the office pages: every transfer touching the
 * office's schools; the office can confirm or turn down those leaving a school in its area.
 */
export function TransfersList({
  basePath,
  canAct = true,
  onChanged,
  emptyText,
}: {
  basePath: "/transfers" | "/office/transfers";
  canAct?: boolean;
  onChanged?: () => void;
  emptyText?: string;
}) {
  const [rows, setRows] = useState<TransferRow[] | null>(null);
  const [confirming, setConfirming] = useState<{ row: TransferRow; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: TransferRow[] }>(basePath);
      setRows(res.data ?? []);
    } catch {
      setRows([]);
    }
  }, [basePath]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async () => {
    if (!confirming) return;
    const { row, action } = confirming;
    setBusy(true);
    try {
      if (action === "cancel") await api.delete(`${basePath}/${row.id}`);
      else await api.post(`${basePath}/${row.id}/${action}`);
      toast.success(
        action === "confirm"
          ? `${row.name} now works at ${row.toSchool.name}`
          : action === "decline"
            ? `Turned down ${row.name}'s transfer`
            : `Withdrew the request for ${row.name}`
      );
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't do that"));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  if (!rows || (rows.length === 0 && !emptyText)) return null;

  const isOffice = basePath === "/office/transfers";

  return (
    <>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <p className="font-medium text-sm">Transfers waiting for confirmation</p>
          {rows.length > 0 && <Badge variant="secondary">{rows.length}</Badge>}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y rounded-md border bg-background">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.name}
                    {r.staffNumber && <span className="ml-2 text-xs text-muted-foreground">{r.staffNumber}</span>}
                    {r.direction && (
                      <Badge variant="outline" className="ml-2">
                        {r.direction === "in" ? "Joining us" : "Leaving us"}
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.fromSchool?.name ?? "No current school"} → {r.toSchool.name} as {ROLE_LABELS[r.role] ?? r.role}
                    {r.requestedAt &&
                      ` · asked ${new Date(r.requestedAt).toLocaleDateString("en-GB")}${r.requestedBy ? ` by ${r.requestedBy}` : ""}`}
                  </p>
                  {r.direction === "in" && (
                    <p className="text-xs text-muted-foreground">
                      Waiting for {r.fromSchool?.name ?? "their school"} (or the district office) to confirm. They keep
                      working there until then.
                    </p>
                  )}
                </div>
                {canAct && (
                  <div className="flex gap-2 shrink-0">
                    {r.direction === "in" ? (
                      <Button size="sm" variant="ghost" onClick={() => setConfirming({ row: r, action: "cancel" })}>
                        Withdraw
                      </Button>
                    ) : !r.canDecide ? (
                      <span className="text-xs text-muted-foreground">
                        {r.direction === "out" ? "Confirmed by your deputy/head or the district office" : `Waiting for ${r.fromSchool?.name ?? "their school"}`}
                      </span>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming({ row: r, action: "decline" })}>
                          Turn down
                        </Button>
                        <Button size="sm" onClick={() => setConfirming({ row: r, action: "confirm" })}>
                          Confirm transfer
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {isOffice && rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            You can confirm transfers out of schools in your area. Transfers out of schools elsewhere are confirmed by
            that school or its office.
          </p>
        )}
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && !busy && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.action === "confirm"
                ? `Confirm ${confirming.row.name}'s transfer?`
                : confirming?.action === "decline"
                  ? "Turn down this transfer?"
                  : "Withdraw this request?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {confirming?.action === "confirm"
                ? `From now on they work at ${confirming.row.toSchool.name}. At ${
                    confirming.row.fromSchool?.name ?? "their old school"
                  } their class-teacher and subject assignments end today, they stop being HOD there, and their timetable periods there need a new teacher. Their records stay.`
                : confirming?.action === "decline"
                  ? "They stay where they are. The other school is told."
                  : "They stay at their current school."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={act} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirming?.action === "confirm" ? (
                "Confirm transfer"
              ) : confirming?.action === "decline" ? (
                "Turn down"
              ) : (
                "Withdraw"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
