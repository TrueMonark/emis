"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { MoneyInput } from "./money-input";
import { InstalmentsEditor, instalmentProblem, toInstalments, type InstalmentDraft } from "./instalments-editor";
import type { FeeCategory, FinanceOptions } from "./types";

/** Term fees for every year level at once: one fee per level, each with its own amount. */
export function TermFeesDialog(props: TermFeesDialogProps) {
  return <TermFeesForm key={String(props.open)} {...props} />;
}

interface TermFeesDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: FinanceOptions;
  onSaved: () => void;
}

function TermFeesForm({
  open,
  onOpenChange,
  options,
  onSaved,
}: TermFeesDialogProps) {
  const yearTerms = options.terms.filter((t) => t.academicYearId === options.activeYear?.id);
  const firstTerm = yearTerms.find((x) => x.isActive) ?? yearTerms[0];
  const [termId, setTermId] = useState(firstTerm?.id ?? "");
  const [name, setName] = useState(firstTerm ? `${firstTerm.label} tuition` : "Tuition");
  const [category, setCategory] = useState<FeeCategory>("TUITION");
  const [dueDate, setDueDate] = useState("");
  const [amounts, setAmounts] = useState<Record<string, number | null>>({});
  const [instalments, setInstalments] = useState<InstalmentDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const fillAll = () => {
    const first = options.grades.map((g) => amounts[g.id]).find((v) => v);
    if (first) setAmounts(Object.fromEntries(options.grades.map((g) => [g.id, first])));
  };

  const save = async () => {
    if (!termId) return toast.error("Choose the term");
    if (!dueDate) return toast.error("Choose the due date");
    const list = options.grades.map((g) => ({ gradeId: g.id, amountNgwee: amounts[g.id] ?? 0 })).filter((a) => a.amountNgwee > 0);
    if (list.length === 0) return toast.error("Give at least one year level an amount");
    const problem = instalmentProblem(instalments);
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      const { data } = await api.post<{ data: { created: number; charged: number } }>("/finance/fees/term-fees", {
        termId,
        name: name.trim(),
        category,
        dueDate,
        amounts: list,
        instalments: toInstalments(instalments),
      });
      toast.success(`${data.created} fee(s) set up, ${data.charged} learner charge(s)`);
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Term fees by year level</DialogTitle>
          <DialogDescription>One fee per year level, charged to every learner in it. Leave a level empty to skip it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Term</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {yearTerms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as FeeCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-name">Name</Label>
              <Input id="tf-name" value={name} onChange={(e) => setName(e.target.value)} />
              <p className="text-xs text-muted-foreground">The year level is added, e.g. “{name || "Tuition"} – Grade 8”.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-due">Due date</Label>
              <Input id="tf-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Amount per learner</Label>
              <Button type="button" variant="ghost" size="sm" onClick={fillAll}>
                Same for all
              </Button>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              {options.grades.map((g) => (
                <div key={g.id} className="grid grid-cols-[1fr_10rem] items-center gap-3">
                  <span className="text-sm">{g.name}</span>
                  <MoneyInput value={amounts[g.id] ?? null} onChange={(v) => setAmounts((a) => ({ ...a, [g.id]: v }))} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment plan (for every level)</Label>
            <InstalmentsEditor value={instalments} onChange={setInstalments} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Set up term fees
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
