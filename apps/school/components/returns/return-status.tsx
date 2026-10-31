"use client";

import { Badge } from "@school/ui/components/badge";
import { RETURN_STATUS_LABELS, type ReturnStatusValue } from "@school/shared/returns/indicators";
import { cn } from "@/lib/utils";
import type { StatusCounts } from "./types";

const STYLE: Record<ReturnStatusValue, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  DRAFT: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  RETURNED: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

export function ReturnStatusBadge({ status, className }: { status: ReturnStatusValue; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-0", STYLE[status], className)}>
      {RETURN_STATUS_LABELS[status]}
    </Badge>
  );
}

const ORDER: ReturnStatusValue[] = ["APPROVED", "SUBMITTED", "RETURNED", "DRAFT", "NOT_STARTED"];

/** "3 approved · 1 waiting · …" as small badges; zeros are left out. */
export function StatusCountBadges({ counts }: { counts: StatusCounts }) {
  const shown = ORDER.filter((s) => counts[s] > 0);
  if (shown.length === 0) return <span className="text-sm text-muted-foreground">No schools</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <Badge key={s} variant="outline" className={cn("border-0 tabular-nums", STYLE[s])}>
          {counts[s]} {RETURN_STATUS_LABELS[s].toLowerCase()}
        </Badge>
      ))}
    </div>
  );
}
