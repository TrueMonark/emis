"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { useFinancePerson } from "@/components/finance/finance-context";
import { FinancePageHeader } from "@/components/finance/page-header";
import { RecordPaymentDialog } from "@/components/finance/record-payment-dialog";
import { dayLabel, k } from "@/components/finance/format";
import type { Payment } from "@/components/finance/types";

interface Overview {
  learners: number;
  chargedNgwee: number;
  paidNgwee: number;
  outstandingNgwee: number;
  overdueNgwee: number;
  owingLearners: number;
  paidUpLearners: number;
  todayNgwee: number;
  monthNgwee: number;
  recentPayments: Payment[];
  classes: { classId: string; classLabel: string; balanceNgwee: number; learners: number }[];
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** School fees overview: what's been charged, collected and is still owed. */
export default function FinanceOverviewPage() {
  const person = useFinancePerson();
  const [data, setData] = useState<Overview | null>(null);
  const [paying, setPaying] = useState(false);
  const load = useCallback(() => {
    api
      .get<{ data: Overview }>("/finance/overview")
      .then(({ data }) => setData(data))
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <FinancePageHeader
        title="School fees"
        description={person.schoolName}
        actions={
          person.canEdit && (
            <Button onClick={() => setPaying(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Record payment
            </Button>
          )
        }
      />
      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Charged (all years)" value={k(data.chargedNgwee)} hint={`${data.learners} learners this year`} />
            <Stat label="Paid" value={k(data.paidNgwee)} hint={`${data.paidUpLearners} fully paid up`} />
            <Stat label="Still owed" value={k(data.outstandingNgwee)} hint={`${data.owingLearners} learners owing`} />
            <Stat label="Overdue now" value={k(data.overdueNgwee)} />
            <Stat label="Collected today" value={k(data.todayNgwee)} />
            <Stat label="Collected this month" value={k(data.monthNgwee)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Owed by class</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/finance/reports">Reports</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Learners owing</TableHead>
                      <TableHead className="text-right">Owed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.classes.map((c) => (
                      <TableRow key={c.classId}>
                        <TableCell>
                          <Link className="hover:underline" href={`/finance/learners?classId=${c.classId}`}>
                            {c.classLabel}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.learners}</TableCell>
                        <TableCell className="text-right tabular-nums">{k(c.balanceNgwee)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Latest payments this month</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/finance/payments">All payments</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.recentPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments yet this month.</p>
                ) : (
                  <Table>
                    <TableBody>
                      {data.recentPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs text-muted-foreground">{dayLabel(p.paidOn)}</TableCell>
                          <TableCell>
                            <Link className="hover:underline" href={`/finance/learners/${p.studentId}`}>
                              {p.learner}
                            </Link>
                            <span className="block text-xs text-muted-foreground">
                              {p.receiptNumber} · {p.methodLabel}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{k(p.amountNgwee)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      <RecordPaymentDialog open={paying} onOpenChange={setPaying} onRecorded={load} />
    </>
  );
}
