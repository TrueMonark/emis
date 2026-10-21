"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { METHODS_NEEDING_REFERENCE, PAYMENT_METHOD_LABELS } from "@school/shared/fees/money";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { LearnerPicker } from "./learner-picker";
import { MoneyInput } from "./money-input";
import { k, todayISO } from "./format";
import type { LearnerAccount, LearnerRow, PaymentMethod, Receipt } from "./types";

const ANY_FEE = "__any";

/**
 * Record a payment. Without a particular fee chosen, the money pays the oldest balances first;
 * choosing a fee (e.g. the trip) pays that fee first. The receipt can be printed straight away.
 */
export function RecordPaymentDialog(props: RecordPaymentDialogProps) {
  // A fresh form every time it opens.
  return <RecordPaymentForm key={`${props.open}-${props.learner?.studentId ?? ""}`} {...props} />;
}

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When opened from a learner's account */
  learner?: LearnerRow | null;
  onRecorded?: (receipt: Receipt) => void;
}

function RecordPaymentForm({
  open,
  onOpenChange,
  learner: fixedLearner,
  onRecorded,
}: RecordPaymentDialogProps) {
  const [learner, setLearner] = useState<LearnerRow | null>(fixedLearner ?? null);
  const [account, setAccount] = useState<LearnerAccount | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [payerName, setPayerName] = useState("");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [feeId, setFeeId] = useState(ANY_FEE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Receipt | null>(null);

  useEffect(() => {
    if (!learner) return;
    let active = true;
    api
      .get<{ data: LearnerAccount }>(`/finance/learners/${learner.studentId}`)
      .then(({ data }) => {
        if (!active) return;
        setAccount(data);
        setPayerName((p) => p || data.learner.guardianName || "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [learner]);
  const chooseLearner = (l: LearnerRow | null) => {
    setAccount(null);
    setLearner(l);
  };

  const needsReference = (METHODS_NEEDING_REFERENCE as readonly string[]).includes(method);
  const openCharges = account?.charges.filter((c) => c.balanceNgwee > 0) ?? [];

  const save = async () => {
    if (!learner) return toast.error("Choose the learner");
    if (!amount || amount <= 0) return toast.error("Enter the amount paid");
    if (needsReference && !reference.trim()) return toast.error("Enter the reference (slip, transaction or cheque number)");
    setSaving(true);
    try {
      const { data } = await api.post<{ data: Receipt }>("/finance/payments", {
        studentId: learner.studentId,
        amountNgwee: amount,
        method,
        reference: reference.trim() || null,
        payerName: payerName.trim() || null,
        paidOn,
        feeId: feeId === ANY_FEE ? null : feeId,
        notes: notes.trim() || null,
      });
      setDone(data);
      toast.success(`Payment recorded: receipt ${data.receiptNumber}`);
      onRecorded?.(data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{done ? "Payment recorded" : "Record a payment"}</DialogTitle>
          <DialogDescription>
            {done ? "Print the receipt for the parent or guardian." : "Money received for a learner's fees."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-2 rounded-md border p-4 text-sm">
            <p>
              Receipt <span className="font-mono font-semibold">{done.receiptNumber}</span>
            </p>
            <p>
              {done.learner}: {k(done.amountNgwee)} by {done.methodLabel}
            </p>
            <p className="text-muted-foreground">Balance now {k(done.balanceAfterNgwee)}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Learner</Label>
              {fixedLearner ? (
                <p className="text-sm font-medium">
                  {fixedLearner.name} <span className="text-muted-foreground font-normal">· {fixedLearner.classLabel}</span>
                </p>
              ) : (
                <LearnerPicker value={learner} onChange={chooseLearner} />
              )}
              {account && (
                <p className="text-xs text-muted-foreground">
                  Balance {k(account.totals.balanceNgwee)}
                  {account.totals.overdueNgwee > 0 ? ` · overdue ${k(account.totals.overdueNgwee)}` : ""}
                  {account.totals.balanceNgwee > 0 && (
                    <button type="button" className="ml-2 underline" onClick={() => setAmount(account.totals.balanceNgwee)}>
                      Pay the full balance
                    </button>
                  )}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pay-amount">Amount</Label>
                <MoneyInput id="pay-amount" value={amount} onChange={setAmount} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-date">Date paid</Label>
                <Input id="pay-date" type="date" max={todayISO()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>How it was paid</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-ref">Reference{needsReference ? "" : " (if any)"}</Label>
                <Input
                  id="pay-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={method === "MOBILE_MONEY" ? "Transaction ID" : method === "CHEQUE" ? "Cheque number" : "Slip number"}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-payer">Paid by</Label>
              <Input id="pay-payer" value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Parent or guardian's name" />
            </div>
            {openCharges.length > 0 && (
              <div className="space-y-1.5">
                <Label>Pay towards</Label>
                <Select value={feeId} onValueChange={setFeeId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_FEE}>Oldest balance first (usual)</SelectItem>
                    {openCharges.map((c) => (
                      <SelectItem key={c.feeId} value={c.feeId}>
                        {c.feeName} — owing {k(c.balanceNgwee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pay-notes">Notes</Label>
              <Textarea id="pay-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          {done ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => window.open(`/finance/print/receipt/${done.id}`, "_blank")}>
                <Printer className="mr-2 h-4 w-4" />
                Print receipt
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record payment
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
