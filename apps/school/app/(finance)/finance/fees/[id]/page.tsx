"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Checkbox } from "@school/ui/components/checkbox";
import { Skeleton } from "@school/ui/components/skeleton";
import { Card, CardContent } from "@school/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { FEE_CATEGORY_LABELS } from "@school/shared/fees/money";
import { api } from "@/lib/api-client";
import { cn, getErrorMessage } from "@/lib/utils";
import { useFinancePerson } from "@/components/finance/finance-context";
import { FinancePageHeader } from "@/components/finance/page-header";
import { MoneyInput } from "@/components/finance/money-input";
import { STATUS_STYLE, dayLabel, k } from "@/components/finance/format";
import { csvKwacha, downloadCsv } from "@/components/finance/csv";
import type { ChargeStatus, Fee } from "@/components/finance/types";

interface FeeLearner {
  studentId: string;
  name: string;
  learnerNumber: string | null;
  classLabel: string | null;
  originalNgwee: number;
  discountNgwee: number;
  amountNgwee: number;
  paidNgwee: number;
  balanceNgwee: number;
  overdueNgwee: number;
  status: ChargeStatus;
}

interface Eligible {
  studentId: string;
  name: string;
  classId: string;
  classLabel: string;
  charged: boolean;
}

/** One fee: every learner charged, what they paid, and (for trips/events) adding who's taking part. */
export default function FeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const person = useFinancePerson();
  const [data, setData] = useState<{ fee: Fee; learners: FeeLearner[] } | null>(null);
  const [filter, setFilter] = useState<"all" | "owing" | "paid">("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ data: { fee: Fee; learners: FeeLearner[] } }>(`/finance/fees/${id}`)
      .then(({ data }) => setData(data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  const rows = useMemo(
    () =>
      (data?.learners ?? []).filter((l) => (filter === "owing" ? l.balanceNgwee > 0 : filter === "paid" ? l.balanceNgwee === 0 : true)),
    [data, filter]
  );

  if (!data) return <Skeleton className="h-96" />;
  const { fee } = data;

  const remove = async (l: FeeLearner) => {
    if (!confirm(`Remove ${l.name}'s charge for ${fee.name}?`)) return;
    try {
      await api.delete(`/finance/fees/${id}/learners/${l.studentId}`);
      toast.success("Charge removed");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const archive = async (archived: boolean) => {
    try {
      await api.patch(`/finance/fees/${id}`, { archived });
      toast.success(archived ? "Fee archived" : "Fee restored");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const del = async () => {
    if (!confirm(`Delete ${fee.name}? Only possible while nobody has been charged.`)) return;
    try {
      await api.delete(`/finance/fees/${id}`);
      toast.success("Fee deleted");
      router.push("/finance/fees");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const csv = () =>
    downloadCsv(
      `${fee.name}`,
      ["Learner", "Learner number", "Class", "Fee (K)", "Discount (K)", "Charged (K)", "Paid (K)", "Balance (K)", "Status"],
      data.learners.map((l) => [
        l.name,
        l.learnerNumber,
        l.classLabel,
        csvKwacha(l.originalNgwee),
        csvKwacha(l.discountNgwee),
        csvKwacha(l.amountNgwee),
        csvKwacha(l.paidNgwee),
        csvKwacha(l.balanceNgwee),
        STATUS_STYLE[l.status]?.label,
      ])
    );

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
        <Link href="/finance/fees">
          <ArrowLeft className="mr-1 h-4 w-4" /> Fees & events
        </Link>
      </Button>
      <FinancePageHeader
        title={fee.name}
        description={
          <>
            {FEE_CATEGORY_LABELS[fee.category]}
            {fee.termLabel ? ` · ${fee.termLabel} ${fee.academicYear}` : ` · ${fee.academicYear}`} · due {dayLabel(fee.dueDate)}
            {fee.archived && " · archived"}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={csv}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            {person.canEdit && (
              <>
                {!fee.archived && (
                  <Button variant="outline" onClick={() => setAdding(true)}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add learners
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                {fee.learners === 0 ? (
                  <Button variant="outline" onClick={del}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => archive(!fee.archived)}>
                    {fee.archived ? "Restore" : "Archive"}
                  </Button>
                )}
              </>
            )}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Amount", k(fee.amountNgwee)],
          ["Learners charged", String(fee.learners)],
          ["Collected", k(fee.paidNgwee)],
          ["Still owed", k(fee.outstandingNgwee)],
        ].map(([l, v]) => (
          <Card key={l}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="text-lg font-semibold tabular-nums">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {fee.instalments.length > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          Payment plan: {fee.instalments.map((i) => `${i.label} ${i.percent}% by ${dayLabel(i.dueDate)}`).join("; ")}
        </p>
      )}
      {fee.description && <p className="mb-4 text-sm">{fee.description}</p>}

      <div className="mb-3 flex gap-2">
        {(["all", "owing", "paid"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "owing" ? "Still owing" : "Paid up"}
          </Button>
        ))}
      </div>
      {data.learners.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Nobody has been charged this fee yet{person.canEdit && !fee.archived ? ": use “Add learners”." : "."}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Charged</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                {person.canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.studentId}>
                  <TableCell>
                    <Link href={`/finance/learners/${l.studentId}`} className="hover:underline">
                      {l.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{l.classLabel ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {k(l.amountNgwee)}
                    {l.discountNgwee > 0 && <span className="block text-xs text-muted-foreground">after {k(l.discountNgwee)} off</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{k(l.paidNgwee)}</TableCell>
                  <TableCell className="text-right tabular-nums">{k(l.balanceNgwee)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("border-0", STATUS_STYLE[l.status]?.className)}>
                      {STATUS_STYLE[l.status]?.label}
                    </Badge>
                  </TableCell>
                  {person.canEdit && (
                    <TableCell className="text-right">
                      {l.paidNgwee === 0 && (
                        <Button variant="ghost" size="icon" onClick={() => remove(l)} aria-label="Remove charge" title="Remove this learner's charge">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {person.canEdit && (
        <>
          {/* keyed so each opening starts with a fresh form */}
          <AddLearnersDialog key={`add-${adding}`} open={adding} onOpenChange={setAdding} feeId={id} onAdded={load} />
          <EditFeeDialog key={`edit-${editing}`} open={editing} onOpenChange={setEditing} fee={fee} onSaved={load} />
        </>
      )}
    </>
  );
}

function AddLearnersDialog({ open, onOpenChange, feeId, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; feeId: string; onAdded: () => void }) {
  const [rows, setRows] = useState<Eligible[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ data: Eligible[] }>(`/finance/fees/${feeId}/learners`)
      .then(({ data }) => setRows(data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [open, feeId]);

  const visible = (rows ?? []).filter((r) => !r.charged && (!q.trim() || `${r.name} ${r.classLabel}`.toLowerCase().includes(q.trim().toLowerCase())));
  const byClass = visible.reduce<Record<string, Eligible[]>>((m, r) => ((m[r.classLabel] ??= []).push(r), m), {});
  const toggle = (id: string) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleClass = (list: Eligible[]) => {
    const all = list.every((r) => chosen.has(r.studentId));
    setChosen((s) => {
      const n = new Set(s);
      list.forEach((r) => (all ? n.delete(r.studentId) : n.add(r.studentId)));
      return n;
    });
  };

  const save = async () => {
    if (chosen.size === 0) return toast.error("Tick the learners to charge");
    setSaving(true);
    try {
      const { data } = await api.post<{ data: { charged: number } }>(`/finance/fees/${feeId}/learners`, { studentIds: [...chosen] });
      toast.success(`${data.charged} learner(s) charged`);
      onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add learners</DialogTitle>
          <DialogDescription>Tick who is taking part (or should pay). Learners already charged aren&apos;t shown.</DialogDescription>
        </DialogHeader>
        <Input placeholder="Filter by name or class" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-h-[55vh] space-y-3 pr-1">
          {!rows ? (
            <Skeleton className="h-40" />
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nobody left to add.</p>
          ) : (
            Object.entries(byClass).map(([label, list]) => (
              <div key={label} className="rounded-md border">
                <label className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-sm font-medium">
                  <Checkbox checked={list.every((r) => chosen.has(r.studentId))} onCheckedChange={() => toggleClass(list)} />
                  {label} <span className="text-xs font-normal text-muted-foreground">({list.length})</span>
                </label>
                {list.map((r) => (
                  <label key={r.studentId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <Checkbox checked={chosen.has(r.studentId)} onCheckedChange={() => toggle(r.studentId)} />
                    {r.name}
                  </label>
                ))}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-sm text-muted-foreground">{chosen.size} ticked</span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Charge them
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditFeeDialog({ open, onOpenChange, fee, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; fee: Fee; onSaved: () => void }) {
  const [name, setName] = useState(fee.name);
  const [amount, setAmount] = useState<number | null>(fee.amountNgwee);
  const [dueDate, setDueDate] = useState(fee.dueDate.slice(0, 10));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!amount) return toast.error("Enter the amount");
    setSaving(true);
    try {
      await api.patch(`/finance/fees/${fee.id}`, { name: name.trim(), amountNgwee: amount, dueDate });
      toast.success(amount !== fee.amountNgwee ? "Fee changed; every learner's charge follows the new amount" : "Fee saved");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit fee</DialogTitle>
          <DialogDescription>Changing the amount changes it for every learner charged (less their discounts).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ef-name">Name</Label>
            <Input id="ef-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <MoneyInput value={amount} onChange={setAmount} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-due">Due date</Label>
              <Input id="ef-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
