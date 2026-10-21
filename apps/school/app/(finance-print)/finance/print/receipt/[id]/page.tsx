"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { PrintLoading, PrintShell } from "@/components/finance/print-shell";
import { dateTimeLabel, dayLabel, k } from "@/components/finance/format";
import type { Receipt } from "@/components/finance/types";

/** A payment receipt for the parent or guardian. */
export default function ReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [r, setR] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<{ data: Receipt }>(`/finance/payments/${id}`)
      .then(({ data }) => setR(data))
      .catch((e) => setError(getErrorMessage(e)));
  }, [id]);
  if (!r) return <PrintLoading error={error} />;

  const line = (label: string, value: string | null | undefined) =>
    value ? (
      <div className="flex justify-between gap-4 border-b border-dotted border-neutral-400 py-1.5 text-sm">
        <span className="text-neutral-600">{label}</span>
        <span className="text-right font-medium">{value}</span>
      </div>
    ) : null;

  return (
    <PrintShell schoolName={r.school.name} title="OFFICIAL RECEIPT" subtitle={<span className="font-mono">{r.receiptNumber}</span>} narrow>
      {r.status === "VOIDED" && (
        <p className="mb-3 border-2 border-red-700 p-2 text-center font-bold text-red-700">
          CANCELLED {dayLabel(r.voidedAt)} — {r.voidReason}
        </p>
      )}
      {line("Date paid", dayLabel(r.paidOn))}
      {line("Received from", r.payerName)}
      {line("For learner", r.learner)}
      {line("Learner number", r.learnerNumber)}
      {line("Class", r.classLabel)}
      {line("Towards", r.feeName ?? "School fees (oldest balance first)")}
      {line("Paid by", r.methodLabel)}
      {line("Reference", r.reference)}
      <div className="my-4 rounded border-2 border-black p-3 text-center">
        <p className="text-xs uppercase">Amount received</p>
        <p className="text-2xl font-bold tabular-nums">{k(r.amountNgwee)}</p>
      </div>
      {line("Balance after this payment", r.balanceAfterNgwee < 0 ? `${k(-r.balanceAfterNgwee)} in credit` : k(r.balanceAfterNgwee))}
      {line("Received by", r.receivedBy)}
      {line("Recorded", dateTimeLabel(r.recordedAt))}
      <div className="mt-10 grid grid-cols-2 gap-8 text-xs">
        <div className="border-t border-black pt-1">Signature</div>
        <div className="border-t border-black pt-1">School stamp</div>
      </div>
    </PrintShell>
  );
}
