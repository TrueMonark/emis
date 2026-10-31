"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Card, CardContent } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@school/ui/components/dialog";
import { isWeekend } from "@school/shared/calendar/weekend";
import { nonSchoolDayLabel, useNonSchoolDay } from "@/hooks/useNonSchoolDay";
import { api } from "@/lib/api-client";
import { cn, getErrorMessage } from "@/lib/utils";

type View = "mine" | "to-approve" | "all";

interface SpecialClass {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  venue: string | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  decisionNote: string | null;
  class: { id: string; label: string };
  subject: { id: string; name: string };
  teacher: { id: string; name: string };
  registerTaken: boolean;
  canDecide: boolean;
  isMine: boolean;
}

interface Option {
  classId: string;
  classLabel: string;
  subjectId: string;
  subjectName: string;
}

const VIEW_LABELS: Record<View, string> = { mine: "My weekend classes", "to-approve": "To approve", all: "All" };
const STATUS: Record<SpecialClass["status"], { label: string; className: string }> = {
  PENDING: { label: "Waiting for HOD", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  APPROVED: { label: "Approved", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  REJECTED: { label: "Turned down", className: "bg-destructive/15 text-destructive" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/**
 * Weekend classes (Phase 5). No attendance is taken on a Saturday or Sunday except for a special
 * class: the teacher asks for one, the HOD of the subject's department approves it (or the head
 * or deputy), and on the day the teacher takes its register here. Used on the teacher, HOD and
 * head teacher pages with different tabs.
 */
export function WeekendClasses({ views, canAsk = true }: { /** Pass a constant array (it's an effect dependency). */ views: View[]; canAsk?: boolean }) {
  const [view, setView] = useState<View>(views[0]);
  const [available, setAvailable] = useState<View[]>(views);
  const [rows, setRows] = useState<SpecialClass[] | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [deciding, setDeciding] = useState<{ row: SpecialClass; action: "approve" | "reject" } | null>(null);
  const [registerFor, setRegisterFor] = useState<SpecialClass | null>(null);
  const closeRegister = useCallback(() => setRegisterFor(null), []);

  const load = useCallback(async () => {
    setRows(null);
    try {
      const res = await api.get<{ data: SpecialClass[] }>(`/special-classes?view=${view}`);
      setRows(res.data ?? []);
    } catch (err) {
      // e.g. "To approve" for someone who isn't an HOD: hide that tab.
      if (view !== views[0]) {
        setAvailable((a) => a.filter((v) => v !== view));
        setView(views[0]);
      } else {
        toast.error(getErrorMessage(err, "Couldn't load weekend classes"));
        setRows([]);
      }
    }
  }, [view, views]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (row: SpecialClass) => {
    if (!window.confirm(`Cancel ${row.subject.name} with ${row.class.label} on ${dayLabel(row.date)}?`)) return;
    try {
      await api.post(`/special-classes/${row.id}/cancel`);
      toast.success("Cancelled");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't cancel"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {available.length > 1 &&
            available.map((v) => (
              <Button key={v} size="sm" variant={v === view ? "default" : "outline"} onClick={() => setView(v)}>
                {VIEW_LABELS[v]}
              </Button>
            ))}
        </div>
        {canAsk && (
          <Button size="sm" onClick={() => setAskOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Ask for a weekend class
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Attendance can&apos;t be taken on a Saturday or Sunday except for a weekend class approved by the HOD of the
        subject&apos;s department (or the head teacher or deputy). Its register is kept apart from the daily register.
      </p>

      {!rows ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {view === "to-approve" ? "Nothing waiting for your approval." : "No weekend classes yet."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {r.subject.name} · {r.class.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dayLabel(r.date)}, {r.startTime}–{r.endTime}
                    {r.venue ? ` · ${r.venue}` : ""}
                    {!r.isMine ? ` · ${r.teacher.name}` : ""}
                  </p>
                  <p className="text-sm mt-1">{r.topic}</p>
                  {r.reason && <p className="text-xs text-muted-foreground">Why: {r.reason}</p>}
                  {r.decisionNote && <p className="text-xs text-muted-foreground">Note: {r.decisionNote}</p>}
                </div>
                <Badge variant="outline" className={cn("border-0", STATUS[r.status].className)}>
                  {STATUS[r.status].label}
                  {r.registerTaken ? " · register taken" : ""}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.canDecide && (
                  <>
                    <Button size="sm" onClick={() => setDeciding({ row: r, action: "approve" })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeciding({ row: r, action: "reject" })}>
                      Turn down
                    </Button>
                  </>
                )}
                {r.status === "APPROVED" && (
                  <Button size="sm" variant="outline" onClick={() => setRegisterFor(r)}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Register
                  </Button>
                )}
                {(r.status === "PENDING" || r.status === "APPROVED") && !r.registerTaken && (r.isMine || view === "all") && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(r)}>
                    Cancel
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AskDialog open={askOpen} onOpenChange={setAskOpen} onCreated={() => (view === "mine" ? load() : setView("mine"))} />
      <DecideDialog deciding={deciding} onClose={() => setDeciding(null)} onDone={load} />
      <RegisterDialog specialClass={registerFor} onClose={closeRegister} onSaved={load} />
    </div>
  );
}

function AskDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [options, setOptions] = useState<Option[]>([]);
  const [pair, setPair] = useState("");
  const [form, setForm] = useState({ date: "", startTime: "08:00", endTime: "10:00", topic: "", venue: "", reason: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ data: Option[] }>("/special-classes/options")
      .then((r) => setOptions(r.data ?? []))
      .catch(() => setOptions([]));
  }, [open]);

  // Weekends, public holidays and closure days (Phase 5b).
  const offDay = useNonSchoolDay(form.date && !isWeekend(form.date) ? form.date : null);
  const dateProblem =
    form.date && !isWeekend(form.date) && !offDay ? "Choose a Saturday, Sunday, public holiday or school closure day" : null;
  const chosen = useMemo(() => options.find((o) => `${o.classId}:${o.subjectId}` === pair), [options, pair]);

  const submit = async () => {
    if (!chosen) return;
    setSaving(true);
    try {
      await api.post("/special-classes", {
        classId: chosen.classId,
        subjectId: chosen.subjectId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        topic: form.topic,
        venue: form.venue || null,
        reason: form.reason || null,
      });
      toast.success("Sent for approval. You'll get a notification when it's decided.");
      onOpenChange(false);
      setPair("");
      setForm({ date: "", startTime: "08:00", endTime: "10:00", topic: "", venue: "", reason: "" });
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't send it"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask for a weekend class</DialogTitle>
          <DialogDescription>
            The HOD of the subject&apos;s department approves it. Once approved, you take its register on the day.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Class and subject</Label>
            <Select value={pair} onValueChange={setPair}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={options.length ? "Choose…" : "You don't teach any class yet"} />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={`${o.classId}:${o.subjectId}`} value={`${o.classId}:${o.subjectId}`}>
                    {o.classLabel} · {o.subjectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="wc-date">Day</Label>
              <Input id="wc-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wc-start">From</Label>
              <Input id="wc-start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wc-end">To</Label>
              <Input id="wc-end" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
          </div>
          {dateProblem && <p className="text-sm text-destructive">{dateProblem}</p>}
          {offDay && <p className="text-xs text-muted-foreground">{nonSchoolDayLabel(offDay)}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="wc-topic">What you&apos;ll teach</Label>
            <Input id="wc-topic" placeholder="e.g. Revision: quadratic equations" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wc-venue">Where (optional)</Label>
            <Input id="wc-venue" placeholder="e.g. Science Laboratory" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wc-reason">Why (optional)</Label>
            <Textarea id="wc-reason" rows={2} placeholder="e.g. Catching up after the sports day" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !chosen || !form.date || !!dateProblem || form.topic.trim().length < 2}>
            {saving ? "Sending…" : "Send for approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecideDialog({
  deciding,
  onClose,
  onDone,
}: {
  deciding: { row: SpecialClass; action: "approve" | "reject" } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!deciding) return;
    setBusy(true);
    try {
      await api.post(`/special-classes/${deciding.row.id}/${deciding.action}`, { note: note || null });
      toast.success(deciding.action === "approve" ? "Approved. The teacher has been told." : "Turned down. The teacher has been told.");
      setNote("");
      onClose();
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save the decision"));
    } finally {
      setBusy(false);
    }
  };

  const r = deciding?.row;
  return (
    <Dialog open={!!deciding} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{deciding?.action === "approve" ? "Approve this weekend class?" : "Turn down this weekend class?"}</DialogTitle>
          {r && (
            <DialogDescription>
              {r.teacher.name}: {r.subject.name} with {r.class.label}, {dayLabel(r.date)} {r.startTime}–{r.endTime}. {r.topic}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="wc-note">Note to the teacher (optional)</Label>
          <Textarea id="wc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button onClick={submit} disabled={busy} variant={deciding?.action === "reject" ? "destructive" : "default"}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : deciding?.action === "approve" ? "Approve" : "Turn down"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Mark = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
const MARKS: { value: Mark; short: string }[] = [
  { value: "PRESENT", short: "P" },
  { value: "ABSENT", short: "A" },
  { value: "LATE", short: "L" },
  { value: "EXCUSED", short: "E" },
];

function RegisterDialog({ specialClass, onClose, onSaved }: { specialClass: SpecialClass | null; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<{
    canTakeRegister: boolean;
    registerProblem: string | null;
    students: { id: string; name: string; status: Mark | null }[];
  } | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!specialClass) return;
    setData(null);
    api
      .get<{ data: { canTakeRegister: boolean; registerProblem: string | null; students: { id: string; name: string; status: Mark | null }[] } }>(
        `/special-classes/${specialClass.id}/register`
      )
      .then((r) => {
        setData(r.data);
        setMarks(Object.fromEntries(r.data.students.map((s) => [s.id, s.status ?? "PRESENT"])));
      })
      .catch((err) => {
        toast.error(getErrorMessage(err, "Couldn't open the register"));
        onClose();
      });
  }, [specialClass, onClose]);

  const save = async () => {
    if (!specialClass || !data) return;
    setSaving(true);
    try {
      await api.put(`/special-classes/${specialClass.id}/register`, {
        records: data.students.map((s) => ({ studentId: s.id, status: marks[s.id] ?? "PRESENT" })),
      });
      toast.success("Register saved");
      onClose();
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save the register"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!specialClass} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Register · {specialClass?.subject.name} · {specialClass?.class.label}
          </DialogTitle>
          {specialClass && (
            <DialogDescription>
              {dayLabel(specialClass.date)}, {specialClass.startTime}–{specialClass.endTime}
            </DialogDescription>
          )}
        </DialogHeader>
        {!data ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <>
            {data.registerProblem && <p className="text-sm text-muted-foreground">{data.registerProblem}</p>}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
              <ul className="divide-y rounded-md border">
                {data.students.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm truncate">{s.name}</span>
                    <div className="flex gap-1 shrink-0">
                      {MARKS.map((m) => (
                        <Button
                          key={m.value}
                          size="sm"
                          variant={marks[s.id] === m.value ? "default" : "outline"}
                          className="h-8 w-8 p-0"
                          disabled={!data.canTakeRegister}
                          onClick={() => setMarks((prev) => ({ ...prev, [s.id]: m.value }))}
                          title={m.value.charAt(0) + m.value.slice(1).toLowerCase()}
                        >
                          {m.short}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          {data?.canTakeRegister && (
            <Button onClick={save} disabled={saving || data.students.length === 0}>
              {saving ? "Saving…" : "Save register"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
