"use client";

import { use, useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { PrintLoading, PrintShell } from "@/components/finance/print-shell";
import { STATUS_STYLE, dayLabel, discountText, k } from "@/components/finance/format";
import type { LearnerAccount } from "@/components/finance/types";

const num = "text-right tabular-nums";

/** A learner's fees statement: every charge, payment and discount, and what is owed. */
export default function StatementPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [a, setA] = useState<LearnerAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<{ data: LearnerAccount }>(`/finance/learners/${id}`)
      .then(({ data }) => setA(data))
      .catch((e) => setError(getErrorMessage(e)));
  }, [id]);
  if (!a) return <PrintLoading error={error} />;
  const payments = a.payments.filter((p) => p.status === "RECORDED");
  const activeDiscounts = a.discounts.filter((d) => !d.endedAt);

  return (
    <PrintShell
      schoolName={a.school.name}
      title="FEES STATEMENT"
      subtitle={
        <>
          {a.learner.name}
          {a.learner.classLabel ? ` · ${a.learner.classLabel}` : ""}
          {a.learner.learnerNumber ? ` · ${a.learner.learnerNumber}` : ""}
          {a.learner.guardianName && <span className="block">Parent/guardian: {a.learner.guardianName}</span>}
        </>
      }
    >
      <p className="mb-1 text-sm font-semibold">Fees</p>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Fee</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className={num}>Fee</TableHead>
            <TableHead className={num}>Discount</TableHead>
            <TableHead className={num}>Charged</TableHead>
            <TableHead className={num}>Paid</TableHead>
            <TableHead className={num}>Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {a.charges.map((c) => (
            <TableRow key={c.chargeId}>
              <TableCell>
                {c.feeName} <span className="text-neutral-500">({c.period})</span>
              </TableCell>
              <TableCell>{dayLabel(c.dueDate)}</TableCell>
              <TableCell className={num}>{k(c.originalNgwee)}</TableCell>
              <TableCell className={num}>{c.discountNgwee ? k(c.discountNgwee) : ""}</TableCell>
              <TableCell className={num}>{k(c.amountNgwee)}</TableCell>
              <TableCell className={num}>{k(c.paidNgwee)}</TableCell>
              <TableCell className={num}>{k(c.balanceNgwee)}</TableCell>
              <TableCell>{STATUS_STYLE[c.status]?.label}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Total</TableCell>
            <TableCell className={num}>{k(a.totals.chargedNgwee)}</TableCell>
            <TableCell className={num}>{k(a.totals.paidNgwee)}</TableCell>
            <TableCell className={num}>{k(a.totals.balanceNgwee)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>

      <p className="mb-1 mt-6 text-sm font-semibold">Payments received</p>
      {payments.length === 0 ? (
        <p className="text-xs">None.</p>
      ) : (
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className={num}>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{dayLabel(p.paidOn)}</TableCell>
                <TableCell className="font-mono">{p.receiptNumber}</TableCell>
                <TableCell>{p.methodLabel}</TableCell>
                <TableCell>{p.reference ?? ""}</TableCell>
                <TableCell className={num}>{k(p.amountNgwee)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {activeDiscounts.length > 0 && (
        <>
          <p className="mb-1 mt-6 text-sm font-semibold">Discounts and bursaries</p>
          <ul className="list-disc pl-5 text-xs">
            {activeDiscounts.map((d) => (
              <li key={d.id}>
                {d.name} ({d.year}): {discountText(d)}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6 flex justify-end">
        <div className="w-72 rounded border-2 border-black p-3 text-sm">
          <div className="flex justify-between">
            <span>Balance</span>
            <span className="font-bold tabular-nums">
              {a.totals.balanceNgwee < 0 ? `${k(-a.totals.balanceNgwee)} credit` : k(a.totals.balanceNgwee)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Of which overdue now</span>
            <span className="tabular-nums">{k(a.totals.overdueNgwee)}</span>
          </div>
        </div>
      </div>
    </PrintShell>
  );
}
