"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Download, GraduationCap, School, Users, CalendarCheck } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { PeriodPicker, presetPeriod, type PeriodValue } from "@/components/returns/period-picker";
import { FacilitiesSummaryView } from "@/components/returns/facilities";
import { FiguresView, KeyIndicatorsTable } from "@/components/returns/figures-view";
import { FIGURES_CSV_HEADER, downloadCsv, figuresCsvCells } from "@/components/returns/csv";
import { day, num, pct, per } from "@/components/returns/format";
import { StatTile } from "@/components/offices/stat-tile";
import type { Dashboard } from "@/components/returns/types";

const ROW_LABEL = { PROVINCE: "Province", DISTRICT: "District", SCHOOL: "School" } as const;

function ProfilesDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const officeId = params.get("officeId");
  const [period, setPeriod] = useState<PeriodValue>(() => presetPeriod("30"));
  const query = new URLSearchParams({ from: period.from, to: period.to, ...(officeId ? { officeId } : {}) }).toString();
  // The answer is kept with the query it answers, so a new choice shows the loading state.
  const [loaded, setLoaded] = useState<{ query: string; data: Dashboard } | null>(null);
  const data = loaded?.query === query ? loaded.data : null;

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: Dashboard }>(`/office/indicators?${query}`)
      .then((r) => !cancelled && setLoaded({ query, data: r.data }))
      .catch((e) => toast.error(getErrorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const open = (row: Dashboard["rows"][number]) => {
    if (row.kind === "SCHOOL") router.push(`/office/schools/${row.id}`);
    else router.push(`/office/profiles?officeId=${row.id}`);
  };

  const exportCsv = () => {
    if (!data) return;
    const kind = data.rows[0]?.kind ?? "SCHOOL";
    downloadCsv(
      `school-profiles-${data.scope.name}-${data.period.from}-to-${data.period.to}`,
      [ROW_LABEL[kind], ...(kind === "SCHOOL" ? ["EMIS number"] : ["Schools"]), ...FIGURES_CSV_HEADER],
      [
        ...data.rows.map((r) => [
          r.name,
          kind === "SCHOOL" ? r.emisNumber ?? "" : r.schools,
          ...figuresCsvCells(r.summary.figures, r.summary.derived),
        ]),
        ["Total", kind === "SCHOOL" ? "" : data.total.schools, ...figuresCsvCells(data.total.figures, data.total.derived)],
      ]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Link href="/office/profiles" className="hover:underline">School profiles</Link>
            {data?.scope.parent && (
              <>
                <ChevronRight className="h-3 w-3" />
                <Link href={`/office/profiles?officeId=${data.scope.parent.id}`} className="hover:underline">{data.scope.parent.name}</Link>
              </>
            )}
            {officeId && data && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span>{data.scope.name}</span>
              </>
            )}
          </div>
          <h1 className="text-xl font-bold">{data?.scope.name ?? "School profiles"}</h1>
          <p className="text-sm text-muted-foreground">
            Figures from the schools&apos; own records, worked out now. Counts only, no learners&apos; names.
            {data && ` Attendance and movement: ${day(data.period.from)} to ${day(data.period.to)}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <PeriodPicker value={period} onChange={setPeriod} />
          <Button variant="outline" onClick={exportCsv} disabled={!data || data.rows.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Spreadsheet
          </Button>
        </div>
      </div>

      {!data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Schools" value={num(data.total.schools)} icon={School} accent="green" />
            <StatTile label="Learners" value={num(data.total.derived.learners)} detail={`${pct(data.total.derived.girlsPercent)} girls`} icon={Users} accent="orange" />
            <StatTile label="Teachers" value={num(data.total.derived.teachers)} detail={`${per(data.total.derived.pupilTeacherRatio)} learners per teacher`} icon={GraduationCap} accent="black" />
            <StatTile label="Attendance" value={pct(data.total.derived.attendancePercent)} detail={`registers taken ${pct(data.total.derived.registersPercent)}`} icon={CalendarCheck} accent="red" />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                By {ROW_LABEL[data.rows[0]?.kind ?? (data.scope.type === "DISTRICT" ? "SCHOOL" : data.scope.type === "PROVINCIAL" ? "DISTRICT" : "PROVINCE")].toLowerCase()}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Click a row to open it.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Learners</TableHead>
                    <TableHead className="text-right">Girls</TableHead>
                    <TableHead className="text-right">Teachers</TableHead>
                    <TableHead className="text-right">Per teacher</TableHead>
                    <TableHead className="text-right">Class size</TableHead>
                    <TableHead className="text-right">Attendance</TableHead>
                    <TableHead className="text-right">Registers</TableHead>
                    <TableHead className="text-right">Per classroom</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">No schools here yet</TableCell>
                    </TableRow>
                  )}
                  {data.rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => open(r)}>
                      <TableCell>
                        <span className="font-medium">{r.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.kind === "SCHOOL" ? r.emisNumber ?? "EMIS number pending" : `${r.schools} school(s)`}
                          {r.inSetup && <Badge variant="outline" className="ml-2">In setup</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.summary.derived.learners)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(r.summary.derived.girlsPercent)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.summary.derived.teachers)}</TableCell>
                      <TableCell className="text-right tabular-nums">{per(r.summary.derived.pupilTeacherRatio)}</TableCell>
                      <TableCell className="text-right tabular-nums">{per(r.summary.derived.averageClassSize)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(r.summary.derived.attendancePercent)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(r.summary.derived.registersPercent)}</TableCell>
                      <TableCell className="text-right tabular-nums">{per(r.summary.derived.learnersPerClassroom)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Indicators for {data.scope.name}</CardTitle></CardHeader>
              <CardContent><KeyIndicatorsTable derived={data.total.derived} label="All schools" /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Facilities</CardTitle></CardHeader>
              <CardContent><FacilitiesSummaryView value={data.total.facilities} /></CardContent>
            </Card>
          </div>

          <FiguresView figures={data.total.figures} />
        </>
      )}
    </div>
  );
}

/** School profiles (Phase 7): the office's schools' figures, by province, district or school. */
export default function OfficeProfilesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ProfilesDashboard />
    </Suspense>
  );
}
