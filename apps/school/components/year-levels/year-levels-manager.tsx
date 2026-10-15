"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GraduationCap, Pencil, Plus, Trash2, LayoutTemplate } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Card, CardContent } from "@school/ui/components/card";
import { Badge } from "@school/ui/components/badge";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Skeleton } from "@school/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@school/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@school/ui/components/select";
import {
  CURRICULUM_LABELS,
  EXAM_LABELS,
  PROVISIONAL_GRADING_EXAMS,
  STAGE_LABELS,
  YEAR_STAGES,
  type Curriculum,
  type NationalExam,
  type YearStage,
} from "@school/shared/curriculum/year-levels";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";

interface YearLevel {
  id: string;
  name: string;
  shortName: string | null;
  stage: YearStage;
  curriculum: Curriculum;
  exam: NationalExam;
  sequence: number;
  nextGradeId: string | null;
  nextGrade: { id: string; name: string } | null;
  _count: { classes: number };
}

interface Template {
  key: string;
  label: string;
  description: string;
  levels: string[];
}

const NONE = "__none__";

interface FormState {
  name: string;
  shortName: string;
  stage: YearStage;
  curriculum: Curriculum;
  exam: NationalExam;
  nextGradeId: string;
}

const emptyForm: FormState = {
  name: "",
  shortName: "",
  stage: "O_LEVEL",
  curriculum: "CBC_2023",
  exam: "NONE",
  nextGradeId: NONE,
};

/**
 * The school's year levels (Phase 3b): Grade and Form side by side, each with its stage,
 * curriculum and national exam, in the school's own order, with where learners normally go
 * next. Head and deputy can change them; everyone else sees the list.
 */
export function YearLevelsManager({ canEdit, onChanged }: { canEdit: boolean; onChanged?: () => void }) {
  const [levels, setLevels] = useState<YearLevel[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<YearLevel | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateKey, setTemplateKey] = useState("");

  const [deleting, setDeleting] = useState<YearLevel | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [l, t] = await Promise.all([
        api.get<{ data: YearLevel[] }>("/year-levels"),
        api.get<{ data: Template[] }>("/year-levels/templates"),
      ]);
      setLevels(l.data ?? []);
      setTemplates(t.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load year levels"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changed = async () => {
    await load();
    onChanged?.();
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (l: YearLevel) => {
    setEditing(l);
    setForm({
      name: l.name,
      shortName: l.shortName ?? "",
      stage: l.stage,
      curriculum: l.curriculum,
      exam: l.exam,
      nextGradeId: l.nextGradeId ?? NONE,
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Give the year level a name");
      return;
    }
    const body = {
      name: form.name.trim(),
      shortName: form.shortName.trim() || null,
      stage: form.stage,
      curriculum: form.curriculum,
      exam: form.exam,
      nextGradeId: form.nextGradeId === NONE ? null : form.nextGradeId,
    };
    setBusy(true);
    try {
      if (editing) await api.patch(`/year-levels/${editing.id}`, body);
      else await api.post("/year-levels", body);
      toast.success(editing ? "Year level updated" : "Year level added");
      setFormOpen(false);
      await changed();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save the year level"));
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, delta: number) => {
    const ids = levels.map((l) => l.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    try {
      const res = await api.put<{ data: YearLevel[] }>("/year-levels/reorder", { ids });
      setLevels(res.data ?? []);
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't change the order"));
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = async () => {
    if (!templateKey) return;
    setBusy(true);
    try {
      const res = await api.post<{ data: { created: string[] } }>("/year-levels/templates", {
        template: templateKey,
      });
      const created = res.data?.created ?? [];
      toast.success(
        created.length > 0
          ? `Added ${created.join(", ")}`
          : "The school already has all of those year levels"
      );
      setTemplateOpen(false);
      await changed();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't add the template"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/year-levels/${deleting.id}`);
      toast.success(`${deleting.name} removed`);
      setDeleting(null);
      await changed();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't remove the year level"));
    } finally {
      setBusy(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.key === templateKey);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {levels.length} year level{levels.length === 1 ? "" : "s"}. Grade and Form levels can run
          side by side during the changeover.
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Add from template
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add year level
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : levels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
              <GraduationCap className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No year levels yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-sm">
              Start from a template (for example &quot;Secondary Forms 1–6&quot; or &quot;Changeover
              2026&quot;) and adjust from there.
            </p>
            {canEdit && (
              <Button onClick={() => setTemplateOpen(true)}>
                <LayoutTemplate className="h-4 w-4 mr-2" />
                Add from template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {levels.map((l, i) => (
            <div
              key={l.id}
              className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 lg:px-4"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="w-6 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {l.name}
                    {l.shortName && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">({l.shortName})</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {STAGE_LABELS[l.stage]} · {CURRICULUM_LABELS[l.curriculum]}
                    {l.nextGrade ? ` · next: ${l.nextGrade.name}` : " · last level"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                {l.exam !== "NONE" && (
                  <Badge variant="secondary" title={EXAM_LABELS[l.exam]}>
                    {examShort(l.exam)}
                    {PROVISIONAL_GRADING_EXAMS.includes(l.exam) && " · provisional grading"}
                  </Badge>
                )}
                <Badge variant="outline">
                  {l._count.classes} class{l._count.classes === 1 ? "" : "es"}
                </Badge>
                {canEdit && (
                  <>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Move up"
                      disabled={busy || i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Move down"
                      disabled={busy || i === levels.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit"
                      onClick={() => openEdit(l)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Remove"
                      disabled={l._count.classes > 0}
                      onClick={() => setDeleting(l)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a year level"}</DialogTitle>
            <DialogDescription>
              The stage and exam decide the grading scale and report card. New-curriculum exams use
              the old scale until ECZ publishes the new one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="yl-name">Name</Label>
                <Input id="yl-name" value={form.name} maxLength={40} placeholder="e.g. Form 1"
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yl-short">Short</Label>
                <Input id="yl-short" value={form.shortName} maxLength={8} placeholder="F1"
                  onChange={(e) => setForm({ ...form, shortName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as YearStage })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEAR_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Curriculum</Label>
                <Select value={form.curriculum} onValueChange={(v) => setForm({ ...form, curriculum: v as Curriculum })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CURRICULUM_LABELS) as Curriculum[]).map((c) => (
                      <SelectItem key={c} value={c}>{CURRICULUM_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>National exam at the end</Label>
                <Select value={form.exam} onValueChange={(v) => setForm({ ...form, exam: v as NationalExam })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EXAM_LABELS) as NationalExam[]).map((e) => (
                      <SelectItem key={e} value={e}>{EXAM_LABELS[e]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Learners normally move on to</Label>
              <Select value={form.nextGradeId} onValueChange={(v) => setForm({ ...form, nextGradeId: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nothing (last level at this school)</SelectItem>
                  {levels
                    .filter((l) => l.id !== editing?.id)
                    .map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used as the default on the promotions screen (e.g. Grade 12 → Form 5). You can still
                choose another class for each cohort there.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add year levels from a template</DialogTitle>
            <DialogDescription>
              Levels the school already has (same name) are kept as they are. New ones go after the
              existing ones; reorder them afterwards if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p>{selectedTemplate.description}</p>
                <p className="text-xs text-muted-foreground">{selectedTemplate.levels.join(" · ")}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
            <Button onClick={applyTemplate} disabled={busy || !templateKey}>
              {busy ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {deleting?.name}?</DialogTitle>
            <DialogDescription>
              It has no classes. Any level that leads to it will no longer have a next level.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function examShort(exam: NationalExam): string {
  switch (exam) {
    case "PSLE_LEGACY":
      return "PSLE (old)";
    case "PSLE_2023":
      return "PSLE (new)";
    case "JSSL":
      return "JSSL";
    case "SC_O_LEGACY":
      return "School Cert. (old)";
    case "SC_O_2023":
      return "School Cert. O-level";
    case "SC_A":
      return "A-level";
    default:
      return "";
  }
}
