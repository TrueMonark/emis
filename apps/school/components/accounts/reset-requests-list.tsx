"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
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
import { OneTimePasswordDialog, type IssuedPassword } from "@/components/accounts/one-time-password-dialog";

export interface ResetRequestRow {
  id: string;
  userId: string;
  requestedAt: string;
  name: string;
  email: string;
  phone: string | null;
  worksAt: { kind: "school" | "office"; name: string; role: string } | null;
}

const ROLE_LABELS: Record<string, string> = {
  HEAD_TEACHER: "Head teacher",
  DEPUTY_HEAD: "Deputy head",
  ADMIN: "Head teacher",
  TEACHER: "Teacher",
  CLERK: "Clerk",
  OFFICE_HEAD: "Head of office",
  OFFICER: "Officer",
};

/**
 * Open "Forgot password?" requests with a "Reset password" button for each — the only place a
 * reset happens (design §3b). Used on the Teachers page (`/password-resets`) and the office
 * pages (`/office/password-resets`). Renders nothing when there are no requests.
 */
export function ResetRequestsList({
  basePath,
  canAct = true,
  onChanged,
  emptyText,
}: {
  basePath: "/password-resets" | "/office/password-resets";
  canAct?: boolean;
  /** Called with the open requests after every load (e.g. to mark rows on the Teachers table) */
  onChanged?: (rows: ResetRequestRow[]) => void;
  /** Shown when there are none (omit to show nothing at all) */
  emptyText?: string;
}) {
  const [rows, setRows] = useState<ResetRequestRow[] | null>(null);
  const [confirming, setConfirming] = useState<{ row: ResetRequestRow; action: "reset" | "decline" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: ResetRequestRow[] }>(basePath);
      setRows(res.data ?? []);
      onChanged?.(res.data ?? []);
    } catch {
      // Not a head/deputy (or office): nothing to show.
      setRows([]);
      onChanged?.([]);
    }
  }, [basePath, onChanged]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      if (confirming.action === "reset") {
        const res = await api.post<{
          data: { name: string; email: string; temporaryPassword: string; temporaryPasswordExpiresAt: string };
        }>(`${basePath}/${confirming.row.id}/reset`);
        setIssued(res.data);
      } else {
        await api.post(`${basePath}/${confirming.row.id}/decline`);
        toast.success(`Turned down ${confirming.row.name}'s request`);
      }
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't do that"));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  if (!rows || (rows.length === 0 && !emptyText)) {
    return <OneTimePasswordDialog issued={issued} reason="reset" onClose={() => setIssued(null)} />;
  }

  return (
    <>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-600" />
          <p className="font-medium text-sm">Password reset requests</p>
          {rows.length > 0 && <Badge variant="secondary">{rows.length}</Badge>}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Before resetting, make sure it&apos;s really them asking (in person or by phone). You&apos;ll get a
              one-time password to give them; it&apos;s shown only once.
            </p>
            <ul className="divide-y rounded-md border bg-background">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground break-all">
                      {[
                        r.worksAt ? `${ROLE_LABELS[r.worksAt.role] ?? r.worksAt.role}, ${r.worksAt.name}` : null,
                        r.email,
                        r.phone,
                        `asked ${new Date(r.requestedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {canAct && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setConfirming({ row: r, action: "decline" })}>
                        Turn down
                      </Button>
                      <Button
                        size="sm"
                        className="bg-amber-600 text-white hover:bg-amber-700"
                        onClick={() => setConfirming({ row: r, action: "reset" })}
                      >
                        Reset password
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && !busy && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.action === "reset" ? `Reset ${confirming?.row.name}'s password?` : "Turn down this request?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {confirming?.action === "reset"
                ? "Have you confirmed it's really them asking? A new one-time password will be shown to you once, to give them in person or by phone. Their old password stops working."
                : "Their password stays as it is. They can ask again from the sign-in page."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={act} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirming?.action === "reset" ? "Reset password" : "Turn down"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OneTimePasswordDialog issued={issued} reason="reset" onClose={() => setIssued(null)} />
    </>
  );
}
