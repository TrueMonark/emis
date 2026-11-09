"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { downloadCsv } from "@/components/finance/csv";
import { StatTile } from "@/components/offices/stat-tile";
import { FlagStripe } from "@/components/offices/flag-stripe";
import { BarList } from "@/components/offices/bar-list";
import { num } from "@/components/returns/format";
import { ClipboardList, CheckCheck, Send, Hourglass } from "lucide-react";

interface Row {
  schoolId: string;
  name: string;
  district: string;
  expected: number;
  notStarted: number;
  draft: number;
  submitted: number;
  hodApproved: number;
  confirmed: number;
}
interface Progress {
  schools: Row[];
  total: Omit<Row, "schoolId" | "name" | "district">;
}

const pctOf = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 1000) / 10) : null);

/**
 * SBA progress for the office (Phase 9b): per school, how many score sheets are expected this
 * school year (each teacher, subject and Form 1–4 class on the 2023 curriculum) and where they
 * are. Counts only: the marks stay at the school.
 */
export default function OfficeSbaPage() {
  const [data, setData] = useState<Progress | null>(null);
  useEffect(() => {
    api
      .get<{ data: Progress }>("/office/sba")
      .then((r) => setData(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  if (!data) return <Skeleton className="h-96" />;
  const t = data.total;

  const exportCsv = () =>
    downloadCsv(
      "sba-progress",
      ["School", "District", "Expected", "Not started", "Draft or sent back", "With the HOD", "With the head", "Confirmed", "Confirmed %"],
      data.schools.map((r) => [r.name, r.district, r.expected, r.notStarted, r.draft, r.submitted, r.hodApproved, r.confirmed, pctOf(r.confirmed, r.expected)])
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div>
            <h1 className="text-xl font-bold">SBA score sheets</h1>
            <p className="text-sm text-muted-foreground">
              School Based Assessment this school year: how far each school is. Counts only; learners&apos; marks stay at the school.
            </p>
          </div>
          <FlagStripe className="max-w-40 rounded-full" />
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={data.schools.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Spreadsheet
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Sheets expected" value={num(t.expected)} detail={`${num(t.notStarted)} not started`} icon={ClipboardList} accent="black" />
        <StatTile label="Being filled in" value={num(t.draft)} detail="drafts and sheets sent back" icon={Hourglass} accent="orange" />
        <StatTile label="Waiting for sign-off" value={num(t.submitted + t.hodApproved)} detail={`${num(t.submitted)} with HODs · ${num(t.hodApproved)} with heads`} icon={Send} accent="red" />
        <StatTile label="Confirmed" value={num(t.confirmed)} detail={`${pctOf(t.confirmed, t.expected) ?? "–"}% of expected`} icon={CheckCheck} accent="green" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Confirmed, lowest first</CardTitle>
        </CardHeader>
        <CardContent>
          <BarList
            items={[...data.schools]
              .filter((r) => r.expected > 0)
              .sort((a, b) => (pctOf(a.confirmed, a.expected) ?? 0) - (pctOf(b.confirmed, b.expected) ?? 0))
              .slice(0, 12)
              .map((r) => ({
                id: r.schoolId,
                label: r.name,
                value: pctOf(r.confirmed, r.expected),
                display: `${pctOf(r.confirmed, r.expected) ?? 0}%`,
                href: `/office/schools/${r.schoolId}`,
                hint: `${r.confirmed} of ${r.expected} confirmed`,
              }))}
            max={100}
            empty="No school has SBA classes yet"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Not started</TableHead>
                <TableHead className="text-right">Filling in</TableHead>
                <TableHead className="text-right">With HOD</TableHead>
                <TableHead className="text-right">With head</TableHead>
                <TableHead className="text-right">Confirmed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.schools.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No schools</TableCell></TableRow>
              )}
              {data.schools.map((r) => (
                <TableRow key={r.schoolId}>
                  <TableCell>
                    <Link href={`/office/schools/${r.schoolId}`} className="font-medium hover:underline">{r.name}</Link>
                    <span className="block text-xs text-muted-foreground">{r.district}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.expected)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.notStarted)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.draft)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.submitted)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.hodApproved)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{num(r.confirmed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
