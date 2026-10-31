"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, Lock, Unlock } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { OFFICE_SHORT } from "@/components/offices/office-labels";
import { ReturnStatusBadge, StatusCountBadges } from "@/components/returns/return-status";
import { FiguresView, KeyIndicatorsTable } from "@/components/returns/figures-view";
import { FacilitiesSummaryView } from "@/components/returns/facilities";
import { FIGURES_CSV_HEADER, downloadCsv, figuresCsvCells } from "@/components/returns/csv";
import { dateTime, day } from "@/components/returns/format";
import type { Round, StatusCounts, Summary } from "@/components/returns/types";
import { RETURN_STATUS_LABELS, type ReturnStatusValue } from "@school/shared/returns/indicators";

type Row =
  | {
      kind: "SCHOOL";
      id: string;
      name: string;
      emisNumber: string | null;
      returnId: string | null;
      status: ReturnStatusValue;
      submittedAt: string | null;
      reviewedAt: string | null;
      submissions: number;
    }
  | { kind: "DISTRICT" | "PROVINCE"; id: string; name: string; schools: number; counts: StatusCounts };

interface RoundDetail {
  round: Round & { canManage: boolean };
  scope: { id: string; name: string; type: "HQ" | "PROVINCIAL" | "DISTRICT" };
  schools: number;
  counts: StatusCounts;
  approved: Summary & { returns: number };
  rows: Row[];
}

function RoundPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const officeId = params.get("officeId");
  const url = `/office/returns/${id}${officeId ? `?officeId=${officeId}` : ""}`;
  const [loaded, setLoaded] = useState<{ url: string; data: RoundDetail } | null>(null);
  const data = loaded?.url === url ? loaded.data : null;

  const load = useCallback(() => {
    api
      .get<{ data: RoundDetail }>(url)
      .then((r) => setLoaded({ url, data: r.data }))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [url]);
  useEffect(load, [load]);

  const setStatus = async (status: "OPEN" | "CLOSED") => {
    if (status === "CLOSED" && !confirm("Close this return? Schools can no longer start, change or submit it. You can reopen it later.")) return;
    try {
      await api.patch(`/office/returns/${id}`, { status });
      toast.success(status === "CLOSED" ? "Return closed" : "Return reopened");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = data.rows;
    if (rows[0]?.kind === "SCHOOL") {
      downloadCsv(`${data.round.title}-${data.scope.name}-progress`, ["School", "EMIS number", "Status", "Submitted", "Times submitted"], rows.map((r) =>
        r.kind === "SCHOOL" ? [r.name, r.emisNumber ?? "", RETURN_STATUS_LABELS[r.status], r.submittedAt ? dateTime(r.submittedAt) : "", r.submissions] : []
      ));
    } else {
      downloadCsv(
        `${data.round.title}-${data.scope.name}-progress`,
        ["Office", "Schools", ...(["APPROVED", "SUBMITTED", "RETURNED", "DRAFT", "NOT_STARTED"] as const).map((s) => RETURN_STATUS_LABELS[s])],
        rows.map((r) => (r.kind !== "SCHOOL" ? [r.name, r.schools, r.counts.APPROVED, r.counts.SUBMITTED, r.counts.RETURNED, r.counts.DRAFT, r.counts.NOT_STARTED] : []))
      );
    }
  };

  const exportApproved = () => {
    if (!data) return;
    downloadCsv(`${data.round.title}-${data.scope.name}-approved-figures`, ["Area", "Approved returns", ...FIGURES_CSV_HEADER], [
      [data.scope.name, data.approved.returns, ...figuresCsvCells(data.approved.figures, data.approved.derived)],
    ]);
  };

  if (!data) return <Skeleton className="h-96" />;
  const r = data.round;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href={officeId ? `/office/returns/${id}` : "/office/returns"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="h-3 w-3" /> {officeId ? r.title : "Returns"}
          </Link>
          <h1 className="text-xl font-bold">
            {r.title}
            {officeId && <span className="font-normal text-muted-foreground"> · {data.scope.name}</span>}
            {r.status === "CLOSED" && <Badge variant="outline" className="ml-2">Closed</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            From {OFFICE_SHORT[r.office.type]} {r.office.name} · period {day(r.periodStart)} to {day(r.periodEnd)} · due {day(r.dueDate)}
            {r.overdue && " (past due)"}
          </p>
          {r.instructions && <p className="mt-1 max-w-2xl text-sm">{r.instructions}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={data.rows.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Progress
          </Button>
          <Button variant="outline" onClick={exportApproved} disabled={data.approved.returns === 0}>
            <Download className="mr-2 h-4 w-4" /> Approved figures
          </Button>
          {r.canManage &&
            (r.status === "OPEN" ? (
              <Button variant="outline" onClick={() => setStatus("CLOSED")}>
                <Lock className="mr-2 h-4 w-4" /> Close
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStatus("OPEN")}>
                <Unlock className="mr-2 h-4 w-4" /> Reopen
              </Button>
            ))}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-medium">{data.schools}</span> school(s) in {data.scope.name}
          </p>
          <StatusCountBadges counts={data.counts} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              {data.rows[0]?.kind === "SCHOOL" || data.rows.length === 0 ? (
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Checked</TableHead>
                </TableRow>
              ) : (
                <TableRow>
                  <TableHead>{data.rows[0].kind === "DISTRICT" ? "District" : "Province"}</TableHead>
                  <TableHead className="text-right">Schools</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No schools here</TableCell></TableRow>
              )}
              {data.rows.map((row) =>
                row.kind === "SCHOOL" ? (
                  <TableRow
                    key={row.id}
                    className={row.returnId ? "cursor-pointer" : undefined}
                    onClick={() => row.returnId && router.push(`/office/school-returns/${row.returnId}`)}
                  >
                    <TableCell>
                      <span className="font-medium">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">{row.emisNumber ?? "EMIS number pending"}</span>
                    </TableCell>
                    <TableCell><ReturnStatusBadge status={row.status} /></TableCell>
                    <TableCell className="text-sm">
                      {row.submittedAt ? dateTime(row.submittedAt) : "–"}
                      {row.submissions > 1 && <span className="block text-xs text-muted-foreground">{row.submissions} times</span>}
                    </TableCell>
                    <TableCell className="text-sm">{row.reviewedAt ? dateTime(row.reviewedAt) : "–"}</TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => router.push(`/office/returns/${id}?officeId=${row.id}`)}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.schools}</TableCell>
                    <TableCell><StatusCountBadges counts={row.counts} /></TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Approved figures</h2>
        <p className="text-sm text-muted-foreground">
          {data.approved.returns === 0
            ? "No approved returns yet. The totals appear here as the DEBS approves them."
            : `Added up over the ${data.approved.returns} approved return(s) in ${data.scope.name}, as the schools submitted them.`}
        </p>
      </div>
      {data.approved.returns > 0 && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Indicators</CardTitle></CardHeader>
              <CardContent><KeyIndicatorsTable derived={data.approved.derived} label="Approved returns" /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Facilities</CardTitle></CardHeader>
              <CardContent><FacilitiesSummaryView value={data.approved.facilities} /></CardContent>
            </Card>
          </div>
          <FiguresView figures={data.approved.figures} />
        </>
      )}
    </div>
  );
}

/** One return round's progress and approved totals (Phase 7). */
export default function OfficeRoundPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <RoundPage />
    </Suspense>
  );
}
