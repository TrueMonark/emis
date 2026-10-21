"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Checkbox } from "@school/ui/components/checkbox";
import { Switch } from "@school/ui/components/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { MoneyInput } from "./money-input";
import { InstalmentsEditor, instalmentProblem, toInstalments, type InstalmentDraft } from "./instalments-editor";
import type { Fee, FeeCategory, FinanceOptions } from "./types";

const NO_TERM = "__none";
type Target = Fee["targetKind"];

const TARGETS: { value: Target; label: string; hint: string }[] = [
  { value: "ALL", label: "Whole school", hint: "Every learner on a class list this year" },
  { value: "YEAR_LEVELS", label: "Year levels", hint: "e.g. Grade 12 exam fees" },
  { value: "CLASSES", label: "Classes", hint: "e.g. one class's trip" },
  { value: "LEARNERS", label: "Chosen learners only", hint: "Add them after (sign-ups for a trip or event)" },
];

/**
 * Set up a fee: a term fee, an event or trip, or any one-off charge. Learners are charged straight
 * away unless it's optional (then finance staff add those taking part).
 */
export function FeeDialog(props: FeeDialogProps) {
  return <FeeForm key={`${props.open}-${props.defaultCategory ?? ""}`} {...props} />;
}

interface FeeDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: FinanceOptions;
  defaultCategory?: FeeCategory;
  onSaved: (fee: Fee & { charged: number }) => void;
}

function FeeForm({
  open,
  onOpenChange,
  options,
  defaultCategory = "TUITION",
  onSaved,
}: FeeDialogProps) {
  const yearTerms = options.terms.filter((t) => t.academicYearId === options.activeYear?.id);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FeeCategory>(defaultCategory);
  const [description, setDescription] = useState("");
  const [termId, setTermId] = useState<string>(() => yearTerms.find((t) => t.isActive)?.id ?? NO_TERM);
  const [amount, setAmount] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [target, setTarget] = useState<Target>(defaultCategory === "TRIP" || defaultCategory === "EVENT" ? "LEARNERS" : "ALL");
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [optional, setOptional] = useState(false);
  const [instalments, setInstalments] = useState<InstalmentDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const save = async () => {
    if (name.trim().length < 2) return toast.error("Name the fee");
    if (!amount) return toast.error("Enter the amount");
    if (!dueDate) return toast.error("Choose the due date");
    const problem = instalmentProblem(instalments);
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      const { data } = await api.post<{ data: Fee & { charged: number } }>("/finance/fees", {
        name: name.trim(),
        category,
        description: description.trim() || null,
        termId: termId === NO_TERM ? null : termId,
        amountNgwee: amount,
        dueDate,
        targetKind: target,
        gradeIds: target === "YEAR_LEVELS" ? gradeIds : [],
        classIds: target === "CLASSES" ? classIds : [],
        optional: target === "LEARNERS" ? true : optional,
        instalments: toInstalments(instalments),
      });
      toast.success(data.charged ? `Fee set up and charged to ${data.charged} learner(s)` : "Fee set up. Add the learners taking part.");
      onSaved(data);
      onOpenChange(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New fee or event</DialogTitle>
          <DialogDescription>School fees for {options.activeYear?.year ?? "this year"}. Amounts in kwacha.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fee-name">Name</Label>
              <Input id="fee-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Term 2 tuition, Grade 9 trip to Livingstone" />
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
              <Label>Term</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TERM}>No term (one-off / whole year)</SelectItem>
                  {yearTerms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee-amount">Amount per learner</Label>
              <MoneyInput id="fee-amount" value={amount} onChange={setAmount} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee-due">Due date</Label>
              <Input id="fee-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Who pays</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {TARGETS.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTarget(t.value)}
                  className={`rounded-md border p-2 text-left text-sm ${target === t.value ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                >
                  <span className="block font-medium">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.hint}</span>
                </button>
              ))}
            </div>
            {target === "YEAR_LEVELS" && (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
                {options.grades.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={gradeIds.includes(g.id)} onCheckedChange={() => toggle(gradeIds, setGradeIds, g.id)} />
                    {g.name}
                  </label>
                ))}
              </div>
            )}
            {target === "CLASSES" && (
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-3">
                {options.classes.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={classIds.includes(c.id)} onCheckedChange={() => toggle(classIds, setClassIds, c.id)} />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
            {target !== "LEARNERS" && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={optional} onCheckedChange={setOptional} />
                Optional: only charge the learners I add (e.g. a trip open to these classes)
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label>Payment plan</Label>
            <InstalmentsEditor value={instalments} onChange={setInstalments} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fee-desc">Notes for parents (optional)</Label>
            <Textarea id="fee-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Set up fee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
