"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Skeleton } from "@school/ui/components/skeleton";
import { Switch } from "@school/ui/components/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { useFinanceOptions } from "@/hooks/useFinanceOptions";
import { FinancePageHeader } from "@/components/finance/page-header";
import { k } from "@/components/finance/format";
import { csvKwacha, downloadCsv } from "@/components/finance/csv";
import type { LearnerRow } from "@/components/finance/types";

const ALL = "__all";

function LearnersInner() {
  const params = useSearchParams();
  const options = useFinanceOptions();
  const [classId, setClassId] = useState(params.get("classId") ?? ALL);
  const [owing, setOwing] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LearnerRow[] | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (classId !== ALL) qs.set("classId", classId);
    if (owing) qs.set("owing", "1");
    api
      .get<{ data: LearnerRow[] }>(`/finance/learners?${qs}`)
      .then(({ data }) => setRows(data))
      .catch(() => setRows([]));
  }, [classId, owing]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !t || r.name.toLowerCase().includes(t) || (r.learnerNumber ?? "").toLowerCase().includes(t));
  }, [rows, q]);
  const total = (f: keyof LearnerRow) => shown.reduce((s, r) => s + (r[f] as number), 0);

  const csv = () =>
    downloadCsv(
      "learner-balances",
      ["Learner", "Learner number", "Class", "Charged (K)", "Paid (K)", "Balance (K)", "Overdue (K)"],
      shown.map((r) => [r.name, r.learnerNumber, r.classLabel, csvKwacha(r.chargedNgwee), csvKwacha(r.paidNgwee), csvKwacha(r.balanceNgwee), csvKwacha(r.overdueNgwee)])
    );

  return (
    <>
      <FinancePageHeader
        title="Learners"
        description="Balances include anything still owed from earlier terms and years."
        actions={
          <Button variant="outline" onClick={csv} disabled={!rows}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Name or learner number" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All classes</SelectItem>
            {options?.classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={owing} onCheckedChange={setOwing} /> Only those owing
        </label>
      </div>
      {!rows ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Charged</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.studentId}>
                  <TableCell>
                    <Link href={`/finance/learners/${r.studentId}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    {r.learnerNumber && <span className="block text-xs text-muted-foreground">{r.learnerNumber}</span>}
                  </TableCell>
                  <TableCell className="text-sm">{r.classLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">{k(r.chargedNgwee)}</TableCell>
                  <TableCell className="text-right tabular-nums">{k(r.paidNgwee)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.balanceNgwee < 0 ? "text-emerald-600" : ""}`}>
                    {r.balanceNgwee < 0 ? `${k(-r.balanceNgwee)} credit` : k(r.balanceNgwee)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${r.overdueNgwee > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {k(r.overdueNgwee)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>{shown.length} learners</TableCell>
                <TableCell className="text-right tabular-nums">{k(total("chargedNgwee"))}</TableCell>
                <TableCell className="text-right tabular-nums">{k(total("paidNgwee"))}</TableCell>
                <TableCell className="text-right tabular-nums">{k(total("balanceNgwee"))}</TableCell>
                <TableCell className="text-right tabular-nums">{k(total("overdueNgwee"))}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </>
  );
}

/** Every learner on this year's class lists with what they owe. */
export default function FinanceLearnersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <LearnersInner />
    </Suspense>
  );
}
