"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { k } from "./format";
import type { Payment } from "./types";

/** Cancel a wrong payment. It stays in the records (and the receipt number isn't reused). */
export function VoidPaymentDialog(props: { payment: Payment | null; onClose: () => void; onVoided: () => void }) {
  return <VoidPaymentForm key={props.payment?.id ?? "none"} {...props} />;
}

function VoidPaymentForm({ payment, onClose, onVoided }: { payment: Payment | null; onClose: () => void; onVoided: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!payment) return;
    if (reason.trim().length < 3) return toast.error("Say why it's being cancelled");
    setSaving(true);
    try {
      await api.post(`/finance/payments/${payment.id}/void`, { reason: reason.trim() });
      toast.success(`Receipt ${payment.receiptNumber} cancelled`);
      onVoided();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel receipt {payment?.receiptNumber}</DialogTitle>
          <DialogDescription>
            {payment ? `${payment.learner}: ${k(payment.amountNgwee)} by ${payment.methodLabel}. ` : ""}
            The payment stops counting but stays on record with your reason. Record the right payment again if needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="void-reason">Reason</Label>
          <Textarea id="void-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong learner, typed K1,500 instead of K150" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancel payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
