"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@school/ui/components/badge";
import { Card, CardContent } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import type { ReturnStatusValue } from "@school/shared/returns/indicators";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { OFFICE_SHORT } from "@/components/offices/office-labels";
import { ReturnStatusBadge } from "@/components/returns/return-status";
import { day } from "@/components/returns/format";
import type { Round } from "@/components/returns/types";

type MyRound = Round & { myStatus: ReturnStatusValue; submittedAt: string | null; reviewedAt: string | null };

/** Returns the education offices have asked this school for (Phase 7). */
export default function SchoolReturnsPage() {
  const [rounds, setRounds] = useState<MyRound[] | null>(null);

  useEffect(() => {
    api
      .get<{ data: MyRound[] }>("/school/returns")
      .then((r) => setRounds(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  const needsAction = (r: MyRound) => r.status === "OPEN" && ["NOT_STARTED", "DRAFT", "RETURNED"].includes(r.myStatus);

  return (
    <div className="space-y-6 p-4 lg:p-0">
      <div>
        <h1 className="text-2xl font-bold">Returns</h1>
        <p className="text-sm text-muted-foreground">
          Figures the district, provincial or national office asks for. Most are filled in from the school&apos;s records; you check them, add the facilities and submit.
        </p>
      </div>
      {!rounds ? (
        <Skeleton className="h-48" />
      ) : rounds.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No returns have been asked for yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rounds.map((r) => (
            <Link key={r.id} href={`/admin/returns/${r.id}`}>
              <Card className={`transition-colors hover:bg-muted/40 ${needsAction(r) ? "border-amber-400" : ""}`}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {r.title}
                      {r.status === "CLOSED" && <Badge variant="outline" className="ml-2">Closed</Badge>}
                      {r.overdue && needsAction(r) && (
                        <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700 dark:text-amber-300">Past due</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From {OFFICE_SHORT[r.office.type]} {r.office.name} · due {day(r.dueDate)}
                    </p>
                  </div>
                  <ReturnStatusBadge status={r.myStatus} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
