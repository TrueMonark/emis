"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { FiguresView, KeyIndicatorsTable } from "./figures-view";
import { FacilitiesView } from "./facilities";
import { ReturnStatusBadge } from "./return-status";
import { dateTime, day } from "./format";
import type { SchoolReturnView } from "./types";

/** The history of a return: who did what, when. */
export function ReturnHistory({ events }: { events: SchoolReturnView["events"] }) {
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="border-l-2 pl-3">
          <p className="text-sm font-medium">{e.label}</p>
          <p className="text-xs text-muted-foreground">
            {dateTime(e.at)}
            {e.by ? ` · ${e.by}` : ""}
          </p>
          {e.comment && <p className="mt-1 text-sm">{e.comment}</p>}
        </li>
      ))}
    </ol>
  );
}

/** The decision banner: sent back (with the DEBS's comment), waiting, or approved. */
export function ReturnStatusBanner({ ret, audience }: { ret: SchoolReturnView; audience: "school" | "office" }) {
  if (ret.status === "RETURNED") {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-medium">
          Sent back for correction{ret.reviewedBy ? ` by ${ret.reviewedBy}` : ""} on {dateTime(ret.reviewedAt)}
        </p>
        {ret.reviewComment && <p className="mt-1 whitespace-pre-line">{ret.reviewComment}</p>}
        {audience === "school" && <p className="mt-1">Correct the return, then submit it again.</p>}
      </div>
    );
  }
  if (ret.status === "SUBMITTED") {
    return (
      <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
        Submitted{ret.submittedBy ? ` by ${ret.submittedBy}` : ""} on {dateTime(ret.submittedAt)}
        {audience === "school" ? ". It's with the DEBS now; you can't change it unless they send it back." : ". Waiting for the DEBS to check it."}
      </div>
    );
  }
  if (ret.status === "APPROVED") {
    return (
      <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
        Approved{ret.reviewedBy ? ` by ${ret.reviewedBy}` : ""} on {dateTime(ret.reviewedAt)}
        {ret.reviewComment ? `: ${ret.reviewComment}` : ""}
      </div>
    );
  }
  return null;
}

/**
 * A school's return, read-only: headline, indicators, counts, facilities, remarks, history.
 * `facilitiesSlot` replaces the facilities card (the school's editable draft).
 */
export function ReturnDocument({
  ret,
  audience,
  facilitiesSlot,
  remarksSlot,
}: {
  ret: SchoolReturnView;
  audience: "school" | "office";
  facilitiesSlot?: React.ReactNode;
  remarksSlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <ReturnStatusBadge status={ret.status} />
        <span>
          Figures worked out {dateTime(ret.figuresAt)} for {day(ret.figures.period.from)} to {day(ret.figures.period.to)}
        </span>
      </div>
      <ReturnStatusBanner ret={ret} audience={audience} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Indicators</CardTitle></CardHeader>
          <CardContent><KeyIndicatorsTable derived={ret.derived} /></CardContent>
        </Card>
        {facilitiesSlot ?? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Facilities</CardTitle></CardHeader>
            <CardContent><FacilitiesView value={ret.facilities} /></CardContent>
          </Card>
        )}
      </div>

      <FiguresView figures={ret.figures} />

      <div className="grid gap-4 lg:grid-cols-2">
        {remarksSlot ?? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Head teacher&apos;s remarks</CardTitle></CardHeader>
            <CardContent className="whitespace-pre-line text-sm">{ret.remarks || <span className="text-muted-foreground">None</span>}</CardContent>
          </Card>
        )}
        <Card className="print:hidden">
          <CardHeader className="pb-2"><CardTitle className="text-base">History</CardTitle></CardHeader>
          <CardContent><ReturnHistory events={ret.events} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
