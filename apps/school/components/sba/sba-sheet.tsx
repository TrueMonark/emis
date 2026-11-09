"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCheck, Loader2, Printer, RotateCcw, Save, Send, Undo2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Skeleton } from "@school/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { sbaTotal, type SbaMarkValue } from "@school/shared/sba/sba";
import { api } from "@/lib/api-client";
import { cn, getErrorMessage } from "@/lib/utils";
import { SbaStatusBadge } from "./status";
import type { SbaSheetDetail, SbaTaskRow } from "./types";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

/** A mark cell as typed: a number, "A" for absent, or empty. */
function parseCell(text: string): SbaMarkValue | "invalid" {
  const t = text.trim();
  if (t === "") return { marks: null, isAbsent: false };
  if (/^a(bs(ent)?)?$/i.test(t)) return { marks: null, isAbsent: true };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return { marks: Math.round(n * 10) / 10, isAbsent: false };
}
const cellText = (m: SbaMarkValue | undefined) => (!m ? "" : m.isAbsent ? "A" : m.marks == null ? "" : String(m.marks));

type Action = "RETURN" | "APPROVE" | "CONFIRM" | "REOPEN" | null;

/**
 * One SBA score sheet (Phase 9b). The teacher who keeps it sets the six tasks and enters marks
 * ("A" = absent), examination numbers and comments, then submits. The HOD approves it or sends it
 * back; the head teacher or deputy confirms it. `backHref` is the SBA list it came from.
 */
export function SbaSheetPage({ id, backHref }: { id: string; backHref: string }) {
  const [data, setData] = useState<SbaSheetDetail | null>(null);
  const [tasks, setTasks] = useState<SbaTaskRow[]>([]);
  const [cells, setCells] = useState<Record<string, Record<number, string>>>({});
  const [notes, setNotes] = useState<Record<string, { exam: string; comment: string }>>({});
  const [dirtyTasks, setDirtyTasks] = useState(false);
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [comment, setComment] = useState("");

  const apply = useCallback((d: SbaSheetDetail) => {
    setData(d);
    setTasks(d.tasks);
    setCells(Object.fromEntries(d.learners.map((l) => [l.studentId, Object.fromEntries(d.tasks.map((t) => [t.number, cellText(l.marks[t.number])]))])));
    setNotes(Object.fromEntries(d.learners.map((l) => [l.studentId, { exam: l.examinationNumber ?? "", comment: l.comment ?? "" }])));
    setDirtyTasks(false);
    setDirtyRows(new Set());
  }, []);

  useEffect(() => {
    api
      .get<{ data: SbaSheetDetail }>(`/sba/${id}`)
      .then((r) => apply(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [id, apply]);

  const editable = !!data?.canEdit;
  const dirty = dirtyTasks || dirtyRows.size > 0;
  const maxBy = useMemo(() => new Map(tasks.map((t) => [t.number, t.maxMarks])), [tasks]);

  const cellProblem = (studentId: string, n: number): string | null => {
    const v = parseCell(cells[studentId]?.[n] ?? "");
    if (v === "invalid") return "Type a number, or A for absent";
    if (!v.isAbsent && v.marks != null && v.marks > (maxBy.get(n) ?? Infinity)) return `Out of ${maxBy.get(n)}`;
    return null;
  };
  const anyProblem = !!data && data.learners.some((l) => tasks.some((t) => cellProblem(l.studentId, t.number)));

  const setCell = (studentId: string, n: number, text: string) => {
    setCells((c) => ({ ...c, [studentId]: { ...c[studentId], [n]: text } }));
    setDirtyRows((d) => new Set(d).add(studentId));
  };
  const setNote = (studentId: string, key: "exam" | "comment", text: string) => {
    setNotes((c) => ({ ...c, [studentId]: { ...c[studentId], [key]: text } }));
    setDirtyRows((d) => new Set(d).add(studentId));
  };
  const setTask = (number: number, patch: Partial<SbaTaskRow>) => {
    setTasks((ts) => ts.map((t) => (t.number === number ? { ...t, ...patch } : t)));
    setDirtyTasks(true);
  };

  /** Save tasks and changed rows; returns the sheet as it is now. */
  const save = async (): Promise<SbaSheetDetail | null> => {
    if (!data) return null;
    let latest = data;
    if (dirtyTasks) {
      latest = (
        await api.patch<{ data: SbaSheetDetail }>(`/sba/${id}/tasks`, {
          tasks: tasks.map((t) => ({ id: t.id, title: t.title, description: t.description || null, maxMarks: Number(t.maxMarks), dueDate: t.dueDate || null })),
        })
      ).data;
    }
    if (dirtyRows.size > 0) {
      const ids = [...dirtyRows];
      const marks = ids.flatMap((sid) =>
        tasks.map((t) => {
          const v = parseCell(cells[sid]?.[t.number] ?? "");
          const m = v === "invalid" ? { marks: null, isAbsent: false } : v;
          return { taskId: t.id, studentId: sid, marks: m.marks, isAbsent: m.isAbsent };
        })
      );
      const noteRows = ids.map((sid) => ({ studentId: sid, examinationNumber: notes[sid]?.exam || null, comment: notes[sid]?.comment || null }));
      latest = (await api.put<{ data: SbaSheetDetail }>(`/sba/${id}/entries`, { marks, notes: noteRows })).data;
    }
    return latest;
  };

  const run = async (key: string, fn: () => Promise<SbaSheetDetail | null>, done: string) => {
    setBusy(key);
    try {
      const d = await fn();
      if (d) apply(d);
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(getErrorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submit = () => {
    if (!confirm("Submit the sheet to your HOD? You can't change it after this unless it's sent back.")) return;
    run("submit", async () => {
      await save();
      return (await api.post<{ data: SbaSheetDetail }>(`/sba/${id}/submit`)).data;
    }, "Submitted to the HOD");
  };

  const decide = async () => {
    if (!action) return;
    const ok = await run(
      action,
      async () => {
        if (action === "APPROVE" || action === "RETURN") {
          return (await api.post<{ data: SbaSheetDetail }>(`/sba/${id}/review`, { decision: action, comment: comment || null })).data;
        }
        if (action === "CONFIRM") return (await api.post<{ data: SbaSheetDetail }>(`/sba/${id}/confirm`)).data;
        return (await api.post<{ data: SbaSheetDetail }>(`/sba/${id}/reopen`, { comment })).data;
      },
      action === "APPROVE" ? "Approved. The head teacher can confirm it now." : action === "RETURN" ? "Sent back to the teacher" : action === "CONFIRM" ? "Confirmed" : "Reopened"
    );
    if (ok) {
      setAction(null);
      setComment("");
    }
  };

  if (!data) return <Skeleton className="m-4 h-96 lg:m-0" />;

  const liveTotal = (studentId: string) =>
    sbaTotal(
      tasks.map((t) => ({ number: t.number, maxMarks: Number(t.maxMarks) || 0 })),
      new Map(tasks.map((t) => {
        const v = parseCell(cells[studentId]?.[t.number] ?? "");
        return [t.number, v === "invalid" ? undefined : v];
      }))
    );
  const needsComment = action === "RETURN" || action === "REOPEN";

  return (
    <div className="space-y-6 p-4 lg:p-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="h-3 w-3" /> SBA score sheets
          </Link>
          <h1 className="text-2xl font-bold">
            {data.subject.name} · {data.class.label}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <SbaStatusBadge status={data.status} />
            <span>
              {data.teacher.name} · {data.year}
              {data.subject.department ? ` · ${data.subject.department}` : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={`/sba/print/${id}`} target="_blank" rel="noreferrer">
              <Printer className="mr-2 h-4 w-4" /> Score sheet
            </a>
          </Button>
          {editable && (
            <>
              <Button variant="outline" disabled={!dirty || anyProblem || !!busy} onClick={() => run("save", save, "Saved")}>
                {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
              </Button>
              <Button disabled={anyProblem || !!busy} onClick={submit}>
                {busy === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Submit to HOD
              </Button>
            </>
          )}
          {data.canReview && (
            <>
              <Button variant="outline" onClick={() => setAction("RETURN")}>
                <Undo2 className="mr-2 h-4 w-4" /> Send back
              </Button>
              <Button onClick={() => setAction("APPROVE")}>
                <Check className="mr-2 h-4 w-4" /> Approve
              </Button>
            </>
          )}
          {data.canConfirm && (
            <Button onClick={() => setAction("CONFIRM")}>
              <CheckCheck className="mr-2 h-4 w-4" /> Confirm
            </Button>
          )}
          {data.canReopen && (
            <Button variant="outline" onClick={() => setAction("REOPEN")}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reopen
            </Button>
          )}
        </div>
      </div>

      {data.status === "RETURNED" && data.reviewComment && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">Sent back{data.hodDecidedBy ? ` by ${data.hodDecidedBy}` : ""}</p>
          <p className="whitespace-pre-line">{data.reviewComment}</p>
        </div>
      )}
      {editable && data.incomplete > 0 && (
        <p className="text-sm text-muted-foreground">
          {data.incomplete} learner(s) still need a mark or &quot;A&quot; (absent) for every task before you can submit.
        </p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tasks</CardTitle>
          <p className="text-xs text-muted-foreground">Two per term. Name each task and set what it&apos;s marked out of; you can change this until the HOD approves the sheet.</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((term) => (
            <div key={term} className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-semibold">Term {term}</p>
              {tasks
                .filter((t) => t.term === term)
                .map((t) => (
                  <div key={t.id} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Task {t.number}</Label>
                    {editable ? (
                      <>
                        <Input value={t.title} onChange={(e) => setTask(t.number, { title: e.target.value })} aria-label={`Task ${t.number} name`} />
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={1}
                            className="w-24"
                            value={t.maxMarks}
                            onChange={(e) => setTask(t.number, { maxMarks: Number(e.target.value) })}
                            aria-label={`Task ${t.number} marked out of`}
                          />
                          <Input type="date" value={t.dueDate ?? ""} onChange={(e) => setTask(t.number, { dueDate: e.target.value || null })} aria-label={`Task ${t.number} date`} />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm">
                        {t.title} <span className="text-muted-foreground">· out of {t.maxMarks}{t.dueDate ? ` · ${t.dueDate.split("-").reverse().join("/")}` : ""}</span>
                      </p>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Marks</CardTitle>
          {editable && <p className="text-xs text-muted-foreground">Type each mark, or A for absent. Remember to Save.</p>}
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">Learner</TableHead>
                <TableHead className="min-w-28">Exam no.</TableHead>
                {tasks.map((t) => (
                  <TableHead key={t.id} className="text-center">
                    T{t.number}
                    <span className="block text-[10px] font-normal text-muted-foreground">/{t.maxMarks}</span>
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="min-w-52">Overall comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.learners.length === 0 && (
                <TableRow><TableCell colSpan={tasks.length + 4} className="text-center text-muted-foreground">No learners in this class this year</TableCell></TableRow>
              )}
              {data.learners.map((l) => {
                const total = editable ? liveTotal(l.studentId) : l.total;
                return (
                  <TableRow key={l.studentId} className={l.left ? "opacity-60" : undefined}>
                    <TableCell>
                      <span className="font-medium">{l.name}</span>
                      <span className="block text-xs text-muted-foreground">{l.left ? "Left the class" : l.learnerNumber}</span>
                    </TableCell>
                    <TableCell>
                      {editable && !l.left ? (
                        <Input className="h-8" value={notes[l.studentId]?.exam ?? ""} onChange={(e) => setNote(l.studentId, "exam", e.target.value)} aria-label={`Examination number for ${l.name}`} />
                      ) : (
                        <span className="text-sm">{l.examinationNumber ?? "–"}</span>
                      )}
                    </TableCell>
                    {tasks.map((t) => {
                      const problem = editable ? cellProblem(l.studentId, t.number) : null;
                      return (
                        <TableCell key={t.id} className="p-1 text-center">
                          {editable && !l.left ? (
                            <Input
                              className={cn("h-8 w-16 text-center tabular-nums", problem && "border-red-500")}
                              value={cells[l.studentId]?.[t.number] ?? ""}
                              onChange={(e) => setCell(l.studentId, t.number, e.target.value)}
                              title={problem ?? undefined}
                              inputMode="decimal"
                              aria-label={`${l.name}, task ${t.number}`}
                            />
                          ) : (
                            <span className="tabular-nums">{cellText(l.marks[t.number]) || "–"}</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right tabular-nums">
                      {total.score}
                      <span className="text-xs text-muted-foreground">/{total.outOf}</span>
                      {total.percent != null && <span className="block text-xs text-muted-foreground">{total.percent}%</span>}
                    </TableCell>
                    <TableCell>
                      {editable && !l.left ? (
                        <Input className="h-8" value={notes[l.studentId]?.comment ?? ""} onChange={(e) => setNote(l.studentId, "comment", e.target.value)} aria-label={`Comment for ${l.name}`} />
                      ) : (
                        <span className="text-sm">{l.comment ?? "–"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {data.events.map((e) => (
              <li key={e.id} className="border-l-2 pl-3">
                <p className="text-sm font-medium">{e.label}</p>
                <p className="text-xs text-muted-foreground">{when(e.at)}{e.by ? ` · ${e.by}` : ""}</p>
                {e.comment && <p className="mt-1 text-sm">{e.comment}</p>}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "APPROVE" ? "Approve this sheet" : action === "RETURN" ? "Send back to the teacher" : action === "CONFIRM" ? "Confirm this sheet" : "Reopen this sheet"}
            </DialogTitle>
            <DialogDescription>
              {action === "APPROVE"
                ? "The head teacher or deputy then confirms it."
                : action === "RETURN"
                  ? "The teacher sees your comment, corrects the sheet and submits it again."
                  : action === "CONFIRM"
                    ? "The sheet is final. Print the score sheet for signing and the date stamp."
                    : "It goes back to the teacher for correction, and has to be approved and confirmed again."}
            </DialogDescription>
          </DialogHeader>
          {action !== "CONFIRM" && (
            <div className="space-y-1">
              <Label htmlFor="sba-comment">{needsComment ? "What needs correcting" : "Note for the teacher (optional)"}</Label>
              <Textarea id="sba-comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button onClick={decide} disabled={!!busy || (needsComment && comment.trim().length < 3)}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {action === "APPROVE" ? "Approve" : action === "RETURN" ? "Send back" : action === "CONFIRM" ? "Confirm" : "Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
