"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Loader2, Play } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { SbaStatusBadge } from "./status";
import type { SbaOverview, SbaSheetDetail, SbaSummary } from "./types";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–");

/**
 * The SBA page (Phase 9b): a teacher's own score sheets (one per subject and class they teach,
 * started or not), and, for an HOD or the head and deputy, the sheets to check or confirm.
 * `basePath` is where a sheet opens: "/teacher/sba" or "/admin/sba".
 */
export function SbaOverviewPage({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [data, setData] = useState<SbaOverview | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<{ data: SbaOverview }>("/sba")
      .then((r) => setData(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const start = async (classId: string, subjectId: string) => {
    setStarting(`${classId}|${subjectId}`);
    try {
      const r = await api.post<{ data: SbaSheetDetail }>("/sba", { classId, subjectId });
      router.push(`${basePath}/${r.data.id}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
      setStarting(null);
    }
  };

  if (!data) return <Skeleton className="m-4 h-64 lg:m-0" />;

  const toAct = data.others.filter((s) => s.canReview || s.canConfirm);
  const rest = data.others.filter((s) => !s.canReview && !s.canConfirm);

  return (
    <div className="space-y-6 p-4 lg:p-0">
      <div>
        <h1 className="text-2xl font-bold">SBA score sheets</h1>
        <p className="text-sm text-muted-foreground">
          School Based Assessment{data.year ? ` for ${data.year.year}` : ""}: six tasks per subject and class (two each term), each marked out of
          what you set. Submit to your HOD when every learner has a mark; the head teacher then confirms it.
        </p>
      </div>

      {!data.year && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">There is no active school year yet.</CardContent></Card>
      )}

      {data.year && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My sheets</CardTitle>
            <p className="text-xs text-muted-foreground">Subjects you teach in Form 1–4 classes on the 2023 curriculum this year.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {data.mine.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">You don&apos;t teach a class that keeps SBA this year.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.mine.map((m) => (
                    <TableRow key={`${m.classId}|${m.subjectId}`}>
                      <TableCell className="font-medium">{m.classLabel}</TableCell>
                      <TableCell>{m.subjectName}</TableCell>
                      <TableCell>{m.sheet ? <SbaStatusBadge status={m.sheet.status} /> : <SbaStatusBadge status="NOT_STARTED" />}</TableCell>
                      <TableCell className="text-right">
                        {m.sheet ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`${basePath}/${m.sheet.id}`}>Open</Link>
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => start(m.classId, m.subjectId)} disabled={!!starting}>
                            {starting === `${m.classId}|${m.subjectId}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Start
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {(data.isHod || data.isLeader) && data.year && (
        <>
          <SheetTable
            title={data.isLeader ? "To check or confirm" : "To check"}
            hint={data.isLeader ? "Sheets waiting for the HOD (when you act for a department) or for your confirmation." : "Sheets your department's teachers have submitted."}
            sheets={toAct}
            basePath={basePath}
            empty="Nothing waiting."
          />
          <SheetTable
            title={data.isLeader ? "All sheets in the school" : "Your department's sheets"}
            sheets={rest}
            basePath={basePath}
            empty="No other sheets started yet."
          />
          {data.notStarted.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Not started yet ({data.notStarted.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {data.notStarted.map((n, i) => (
                    <li key={i}>
                      {n.teacher} · {n.subjectName} · {n.classLabel}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SheetTable({ title, hint, sheets, basePath, empty }: { title: string; hint?: string; sheets: SbaSummary[]; basePath: string; empty: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-muted-foreground" /> {title}
        </CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {sheets.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheets.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.teacher.name}</TableCell>
                  <TableCell>{s.subject.name}</TableCell>
                  <TableCell>{s.class.label}</TableCell>
                  <TableCell><SbaStatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-sm">{when(s.submittedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant={s.canReview || s.canConfirm ? "default" : "outline"}>
                      <Link href={`${basePath}/${s.id}`}>{s.canReview ? "Check" : s.canConfirm ? "Confirm" : "Open"}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
