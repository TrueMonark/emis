"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Card, CardContent } from "@school/ui/components/card";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Skeleton } from "@school/ui/components/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { OFFICE_SHORT } from "@/components/offices/office-labels";
import { StatusCountBadges } from "@/components/returns/return-status";
import { day } from "@/components/returns/format";
import type { Round, StatusCounts } from "@/components/returns/types";

type RoundRow = Round & { schools: number; counts: StatusCounts; canManage: boolean };

/** Returns (Phase 7): the rounds the offices have opened for this office's schools. */
export default function OfficeReturnsPage() {
  const [data, setData] = useState<{ rounds: RoundRow[]; canOpen: boolean } | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ data: { rounds: RoundRow[]; canOpen: boolean } }>("/office/returns")
      .then((r) => setData(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Returns</h1>
          <p className="text-sm text-muted-foreground">
            The office opens a return; each school&apos;s head fills it in from the school&apos;s records and submits it; the DEBS approves it or sends it back.
          </p>
        </div>
        {data?.canOpen && (
          <Button onClick={() => setOpening(true)}>
            <Plus className="mr-2 h-4 w-4" /> Open a return
          </Button>
        )}
      </div>

      {!data ? (
        <Skeleton className="h-64" />
      ) : data.rounds.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No returns yet.{data.canOpen ? " Open one to ask your schools for their figures." : ""}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.rounds.map((r) => (
            <Link key={r.id} href={`/office/returns/${r.id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {r.title}
                      {r.status === "CLOSED" && <Badge variant="outline" className="ml-2">Closed</Badge>}
                      {r.overdue && <Badge variant="outline" className="ml-2 border-amber-500 text-amber-700 dark:text-amber-300">Past due</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From {OFFICE_SHORT[r.office.type]} {r.office.name} · period {day(r.periodStart)} to {day(r.periodEnd)} · due {day(r.dueDate)} ·{" "}
                      {r.schools} school(s)
                    </p>
                  </div>
                  <StatusCountBadges counts={r.counts} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <OpenRoundDialog open={opening} onClose={() => setOpening(false)} onOpened={load} />
    </div>
  );
}

function OpenRoundDialog({ open, onClose, onOpened }: { open: boolean; onClose: () => void; onOpened: () => void }) {
  const year = new Date().getFullYear();
  const [form, setForm] = useState({ title: "", instructions: "", periodStart: `${year}-01-01`, periodEnd: "", dueDate: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post("/office/returns", { ...form, instructions: form.instructions || null });
      toast.success("Return opened. The head teachers will see it on their Returns page.");
      setForm({ title: "", instructions: "", periodStart: `${year}-01-01`, periodEnd: "", dueDate: "" });
      onClose();
      onOpened();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a return</DialogTitle>
          <DialogDescription>
            Every active school in your area gets it. Their figures are worked out from their records; they add their facilities.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="r-title">Name</Label>
            <Input id="r-title" placeholder="e.g. 2026 Annual School Census" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="r-from">Period from</Label>
              <Input id="r-from" type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-to">Period to</Label>
              <Input id="r-to" type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-due">Due</Label>
              <Input id="r-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Attendance, registers, admissions and leavers are counted over the period (up to the day the school fills it in).
          </p>
          <div className="space-y-1">
            <Label htmlFor="r-ins">Instructions for the schools (optional)</Label>
            <Textarea id="r-ins" rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.title || !form.periodStart || !form.periodEnd || !form.dueDate}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Open the return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
