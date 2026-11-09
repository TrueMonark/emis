"use client";

import { Badge } from "@school/ui/components/badge";
import { SBA_STATUS_LABELS, type SbaStatusValue } from "@school/shared/sba/sba";
import { cn } from "@/lib/utils";

const STYLE: Record<SbaStatusValue, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  DRAFT: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  RETURNED: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300",
  HOD_APPROVED: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  CONFIRMED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

export function SbaStatusBadge({ status, className }: { status: SbaStatusValue; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-0", STYLE[status], className)}>
      {SBA_STATUS_LABELS[status]}
    </Badge>
  );
}
