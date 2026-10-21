"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Download, Plus, Printer, Search } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Skeleton } from "@school/ui/components/skeleton";
import { Switch } from "@school/ui/components/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { PAYMENT_METHOD_LABELS } from "@school/shared/fees/money";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useFinancePerson } from "@/components/finance/finance-context";
import { FinancePageHeader } from "@/components/finance/page-header";
import { RecordPaymentDialog } from "@/components/finance/record-payment-dialog";
import { VoidPaymentDialog } from "@/components/finance/void-payment-dialog";
import { dayLabel, k, todayISO } from "@/components/finance/format";
import { csvKwacha, downloadCsv } from "@/components/finance/csv";
import type { Payment } from "@/components/finance/types";

const ALL = "__all";
const monthStart = () => `${todayISO().slice(0, 8)}01`;

/** Every payment (receipt book): search, print a receipt, cancel a wrong one. */
export default function PaymentsPage() {
  const person = useFinancePerson();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const [method, setMethod] = useState(ALL);
  const [q, setQ] = useState("");
  const [voided, setVoided] = useState(false);
  const [rows, setRows] = useState<Payment[] | null>(null);
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState<Payment | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (method !== ALL) qs.set("method", method);
    if (q.trim()) qs.set("q", q.trim());
    if (voided) qs.set("voided", "1");
    api
      .get<{ data: Payment[] }>(`/finance/payments?${qs}`)
      .then(({ data }) => setRows(data))
      .catch(() => setRows([]));
  }, [from, to, method, q, voided]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const recorded = (rows ?? []).filter((p) => p.status === "RECORDED");
  const csv = () =>
    downloadCsv(
      `payments-${from}-to-${to}`,
      ["Date", "Receipt", "Learner", "Learner number", "Amount (K)", "Method", "Reference", "Paid by", "Towards", "Received by", "Status", "Cancel reason"],
      (rows ?? []).map((p) => [
        dayLabel(p.paidOn),
        p.receiptNumber,
        p.learner,
        p.learnerNumber,
        csvKwacha(p.amountNgwee),
        p.methodLabel,
        p.reference,
        p.payerName,
        p.feeName,
        p.receivedBy,
        p.status === "VOIDED" ? "Cancelled" : "Recorded",
        p.voidReason,
      ])
    );

  return (
    <>
      <FinancePageHeader
        title="Payments"
        description="Cancelled payments stay on record but don't count."
        actions={
          <>
            <Button variant="outline" onClick={csv} disabled={!rows}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            {person.canEdit && (
              <Button onClick={() => setPaying(true)}>
                <Plus className="mr-2 h-4 w-4" /> Record payment
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any method</SelectItem>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Receipt, reference or name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Switch checked={voided} onCheckedChange={setVoided} /> Show cancelled
        </label>
      </div>
      {!rows ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">No payments in these dates.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Learner</TableHead>
                <TableHead>How</TableHead>
                <TableHead>Received by</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} className={p.status === "VOIDED" ? "opacity-60" : undefined}>
                  <TableCell className="text-sm">{dayLabel(p.paidOn)}</TableCell>
                  <TableCell>
                    <span className={cn("font-mono text-sm", p.status === "VOIDED" && "line-through")}>{p.receiptNumber}</span>
                    {p.status === "VOIDED" && <span className="block text-xs text-destructive">Cancelled: {p.voidReason}</span>}
                  </TableCell>
                  <TableCell>
                    <Link href={`/finance/learners/${p.studentId}`} className="hover:underline">
                      {p.learner}
                    </Link>
                    {p.feeName && <span className="block text-xs text-muted-foreground">towards {p.feeName}</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.methodLabel}
                    {p.reference && <span className="block text-xs text-muted-foreground">{p.reference}</span>}
                  </TableCell>
                  <TableCell className="text-sm">{p.receivedBy ?? "—"}</TableCell>
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
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>{recorded.length} payments</TableCell>
                <TableCell className="text-right tabular-nums">{k(recorded.reduce((s, p) => s + p.amountNgwee, 0))}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
      {person.canEdit && (
        <>
          <RecordPaymentDialog open={paying} onOpenChange={setPaying} onRecorded={load} />
          <VoidPaymentDialog payment={voiding} onClose={() => setVoiding(null)} onVoided={load} />
        </>
      )}
    </>
  );
}
