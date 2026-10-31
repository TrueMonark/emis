"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Smartphone, Monitor, Search } from "lucide-react";
import { Badge } from "@school/ui/components/badge";
import { Input } from "@school/ui/components/input";
import { Skeleton } from "@school/ui/components/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { cn, getErrorMessage } from "@/lib/utils";

interface Change {
  id: string;
  studentId: string;
  learner: string;
  action: "CREATED" | "CHANGED" | "DELETED" | "PHONE_NOT_APPLIED";
  oldMarks: number | null;
  newMarks: number | null;
  oldAbsent: boolean | null;
  newAbsent: boolean | null;
  oldRemarks: string | null;
  newRemarks: string | null;
  changedBy: string;
  source: "WEB" | "PHONE" | "SYSTEM" | string;
  note: string | null;
  changedAt: string;
}

const mark = (marks: number | null, absent: boolean | null) => (absent ? "AB" : marks == null ? "—" : String(marks));

const ACTION: Record<Change["action"], { label: string; className: string }> = {
  CREATED: { label: "Entered", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  CHANGED: { label: "Changed", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  DELETED: { label: "Deleted", className: "bg-destructive/15 text-destructive" },
  PHONE_NOT_APPLIED: { label: "Phone change not applied", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};

/**
 * Marks history (Phase 5b): every time a mark of this assessment was entered, changed or
 * deleted, by whom, when, and from the web or a phone. Newest first. Optionally one learner.
 */
export function MarksHistoryDialog({
  assessmentId,
  studentId,
  open,
  onOpenChange,
}: {
  assessmentId: string | null;
  studentId?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [data, setData] = useState<{ title: string; total: number; changes: Change[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open || !assessmentId) return;
    let active = true;
    api
      .get<{ data: { assessment: { title: string; totalMarks: number }; changes: Change[] } }>(
        `/assessments/${assessmentId}/history${studentId ? `?studentId=${studentId}` : ""}`
      )
      .then(({ data }) => active && setData({ title: data.assessment.title, total: data.assessment.totalMarks, changes: data.changes }))
      .catch((e) => active && setError(getErrorMessage(e)));
    return () => {
      active = false;
    };
  }, [open, assessmentId, studentId]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.changes ?? []).filter((c) => !t || c.learner.toLowerCase().includes(t));
  }, [data, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Marks history
          </DialogTitle>
          <DialogDescription>{data ? `${data.title} (out of ${data.total})` : "Every entry and change, newest first."}</DialogDescription>
        </DialogHeader>
        {!studentId && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-8 text-sm" placeholder="Filter by learner" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-h-[60vh] -mx-1 px-1">
          {error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : !data ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {shown.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <span className="mt-0.5 text-muted-foreground" title={c.source === "PHONE" ? "From a phone" : c.source === "SYSTEM" ? "System" : "On the web"}>
                    {c.source === "PHONE" ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!studentId && <span className="font-medium">{c.learner}</span>}
                      <Badge variant="outline" className={cn("border-0", ACTION[c.action]?.className)}>
                        {ACTION[c.action]?.label ?? c.action}
                      </Badge>
                      <span className="tabular-nums">
                        {c.action === "CREATED"
                          ? mark(c.newMarks, c.newAbsent)
                          : c.action === "DELETED"
                            ? `${mark(c.oldMarks, c.oldAbsent)} removed`
                            : c.action === "PHONE_NOT_APPLIED"
                              ? `phone sent ${mark(c.newMarks, c.newAbsent)}, kept ${mark(c.oldMarks, c.oldAbsent)}`
                              : `${mark(c.oldMarks, c.oldAbsent)} → ${mark(c.newMarks, c.newAbsent)}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.changedBy} · {new Date(c.changedAt).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {c.source === "PHONE" ? " · phone" : ""}
                    </p>
                    {c.oldRemarks !== c.newRemarks && c.action === "CHANGED" && (
                      <p className="text-xs text-muted-foreground">
                        Remark: {c.oldRemarks || "none"} → {c.newRemarks || "none"}
                      </p>
                    )}
                    {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
