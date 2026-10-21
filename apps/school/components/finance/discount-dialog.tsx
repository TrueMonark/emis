"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Checkbox } from "@school/ui/components/checkbox";
import { RadioGroup, RadioGroupItem } from "@school/ui/components/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { FEE_CATEGORY_LABELS } from "@school/shared/fees/money";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { LearnerPicker } from "./learner-picker";
import { MoneyInput } from "./money-input";
import type { FeeCategory, LearnerRow } from "./types";

const PRESETS = ["Sibling discount", "Staff child", "Bursary", "Scholarship", "Early payment"];

/**
 * Give a learner a discount or bursary for this year: a percentage or a fixed amount off each
 * matching fee (all fees, or chosen kinds such as tuition only). Their charges are recalculated.
 */
export function DiscountDialog(props: DiscountDialogProps) {
  return <DiscountForm key={`${props.open}-${props.learner?.studentId ?? ""}`} {...props} />;
}

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  learner?: LearnerRow | null;
  onSaved: () => void;
}

function DiscountForm({
  open,
  onOpenChange,
  learner: fixedLearner,
  onSaved,
}: DiscountDialogProps) {
  const [learner, setLearner] = useState<LearnerRow | null>(fixedLearner ?? null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [categories, setCategories] = useState<FeeCategory[]>(["TUITION"]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (c: FeeCategory) => setCategories((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const save = async () => {
    if (!learner) return toast.error("Choose the learner");
    const value = kind === "PERCENT" ? Number(percent) : amount;
    if (!value || value <= 0 || (kind === "PERCENT" && (!Number.isInteger(value) || value > 100))) {
      return toast.error(kind === "PERCENT" ? "Enter a whole percentage from 1 to 100" : "Enter the amount off");
    }
    setSaving(true);
    try {
      const { data } = await api.post<{ data: { chargesUpdated: number } }>("/finance/discounts", {
        studentId: learner.studentId,
        name: name.trim(),
        kind,
        value,
        categories,
        reason: reason.trim() || null,
      });
      toast.success(`Discount given${data.chargesUpdated ? `; ${data.chargesUpdated} charge(s) updated` : ""}`);
      onSaved();
      onOpenChange(false);
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
          <DialogTitle>Discount or bursary</DialogTitle>
          <DialogDescription>For this academic year. Fees already charged are recalculated, and new fees include it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Learner</Label>
            {fixedLearner ? <p className="text-sm font-medium">{fixedLearner.name}</p> : <LearnerPicker value={learner} onChange={setLearner} />}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="disc-name">Name</Label>
            <Input id="disc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sibling discount" />
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button type="button" key={p} className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted" onClick={() => setName(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>How much</Label>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as "PERCENT" | "AMOUNT")} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="PERCENT" /> A percentage
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="AMOUNT" /> A fixed amount (off each fee)
              </label>
            </RadioGroup>
            {kind === "PERCENT" ? (
              <div className="relative w-32">
                <Input inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, ""))} className="pr-7" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            ) : (
              <div className="w-48">
                <MoneyInput value={amount} onChange={setAmount} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>On which fees</Label>
            <p className="text-xs text-muted-foreground">Tick none for every fee.</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FEE_CATEGORY_LABELS) as FeeCategory[]).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={categories.includes(c)} onCheckedChange={() => toggle(c)} />
                  {FEE_CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="disc-reason">Reason / approved by</Label>
            <Textarea id="disc-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Give discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
