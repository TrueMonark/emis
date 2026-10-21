"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, BadgePercent, Ban, Plus, Printer } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Skeleton } from "@school/ui/components/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { cn, getErrorMessage } from "@/lib/utils";
import { useFinancePerson } from "@/components/finance/finance-context";
import { FinancePageHeader } from "@/components/finance/page-header";
import { RecordPaymentDialog } from "@/components/finance/record-payment-dialog";
import { DiscountDialog } from "@/components/finance/discount-dialog";
import { VoidPaymentDialog } from "@/components/finance/void-payment-dialog";
import { STATUS_STYLE, dayLabel, discountText, k } from "@/components/finance/format";
import type { Discount, LearnerAccount, LearnerRow, Payment } from "@/components/finance/types";

/** A learner's fees account: charges, payments, discounts; record a payment or print a statement. */
export default function LearnerAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const person = useFinancePerson();
  const [data, setData] = useState<LearnerAccount | null>(null);
  const [paying, setPaying] = useState(false);
  const [discounting, setDiscounting] = useState(false);
  const [voiding, setVoiding] = useState<Payment | null>(null);

  const load = useCallback(() => {
    api
      .get<{ data: LearnerAccount }>(`/finance/learners/${id}`)
      .then(({ data }) => setData(data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  if (!data) return <Skeleton className="h-96" />;
  const { learner, totals } = data;
  const asRow: LearnerRow = {
    studentId: learner.id,
    name: learner.name,
    learnerNumber: learner.learnerNumber,
    classId: "",
    classLabel: learner.classLabel ?? "",
    chargedNgwee: totals.chargedNgwee,
    paidNgwee: totals.paidNgwee,
    balanceNgwee: totals.balanceNgwee,
    overdueNgwee: totals.overdueNgwee,
    creditNgwee: totals.creditNgwee,
  };

  const endDiscount = async (d: Discount) => {
    if (!confirm(`End "${d.name}"? This year's charges go back up.`)) return;
    try {
      await api.post(`/finance/discounts/${d.id}/end`);
      toast.success("Discount ended");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
        <Link href="/finance/learners">
          <ArrowLeft className="mr-1 h-4 w-4" /> Learners
        </Link>
      </Button>
      <FinancePageHeader
        title={learner.name}
        description={
          <>
            {learner.classLabel ?? "Not on a class list this year"}
            {learner.learnerNumber ? ` · ${learner.learnerNumber}` : ""}
            {learner.guardianName ? ` · Guardian: ${learner.guardianName}` : ""}
            {learner.guardianPhone ? ` (${learner.guardianPhone})` : ""}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => window.open(`/finance/print/statement/${id}`, "_blank")}>
              <Printer className="mr-2 h-4 w-4" /> Statement
            </Button>
            {person.canEdit && (
              <>
                <Button variant="outline" onClick={() => setDiscounting(true)}>
                  <BadgePercent className="mr-2 h-4 w-4" /> Discount
                </Button>
                <Button onClick={() => setPaying(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Record payment
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Charged", k(totals.chargedNgwee), totals.discountNgwee ? `after ${k(totals.discountNgwee)} discounts` : ""],
          ["Paid", k(totals.paidNgwee), ""],
          ["Balance", totals.balanceNgwee < 0 ? `${k(-totals.balanceNgwee)} credit` : k(totals.balanceNgwee), ""],
          ["Overdue now", k(totals.overdueNgwee), ""],
        ].map(([l, v, h]) => (
          <Card key={l}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="text-lg font-semibold tabular-nums">{v}</p>
              {h && <p className="text-xs text-muted-foreground">{h}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fees charged</CardTitle>
          </CardHeader>
          <CardContent>
            {data.charges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fees charged.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fee</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Charged</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.charges.map((c) => (
                    <TableRow key={c.chargeId}>
                      <TableCell>
                        <Link href={`/finance/fees/${c.feeId}`} className="hover:underline">
                          {c.feeName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {c.categoryLabel} · {c.period}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{dayLabel(c.dueDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {k(c.amountNgwee)}
                        {c.discountNgwee > 0 && <span className="block text-xs text-muted-foreground">{k(c.originalNgwee)} − {k(c.discountNgwee)}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{k(c.paidNgwee)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {k(c.balanceNgwee)}
                        {c.overdueNgwee > 0 && <span className="block text-xs text-destructive">{k(c.overdueNgwee)} overdue</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("border-0", STATUS_STYLE[c.status]?.className)}>
                          {STATUS_STYLE[c.status]?.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {data.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>How</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow key={p.id} className={p.status === "VOIDED" ? "opacity-60" : undefined}>
                      <TableCell className="text-sm">{dayLabel(p.paidOn)}</TableCell>
                      <TableCell>
                        <span className={cn("font-mono text-sm", p.status === "VOIDED" && "line-through")}>{p.receiptNumber}</span>
                        {p.feeName && <span className="block text-xs text-muted-foreground">towards {p.feeName}</span>}
                        {p.status === "VOIDED" && <span className="block text-xs text-destructive">Cancelled: {p.voidReason}</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.methodLabel}
                        {p.reference && <span className="block text-xs text-muted-foreground">{p.reference}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{k(p.amountNgwee)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" title="Print receipt" onClick={() => window.open(`/finance/print/receipt/${p.id}`, "_blank")}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        {person.canEdit && p.status === "RECORDED" && (
                          <Button variant="ghost" size="icon" title="Cancel this payment" onClick={() => setVoiding(p)}>
                            <Ban className="h-4 w-4" />
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discounts & bursaries</CardTitle>
          </CardHeader>
          <CardContent>
            {data.discounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="space-y-2">
                {data.discounts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className={d.endedAt ? "text-muted-foreground line-through" : undefined}>
                      <span className="font-medium">{d.name}</span> ({d.year}): {discountText(d)}
                      {d.reason ? ` — ${d.reason}` : ""}
                    </span>
                    {person.canEdit && !d.endedAt && (
                      <Button variant="outline" size="sm" onClick={() => endDiscount(d)}>
                        End
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {person.canEdit && (
        <>
          <RecordPaymentDialog open={paying} onOpenChange={setPaying} learner={asRow} onRecorded={load} />
          <DiscountDialog open={discounting} onOpenChange={setDiscounting} learner={asRow} onSaved={load} />
          <VoidPaymentDialog payment={voiding} onClose={() => setVoiding(null)} onVoided={load} />
        </>
      )}
    </>
  );
}
