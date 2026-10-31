"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Skeleton } from "@school/ui/components/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { YearPicker } from "@/components/calendar/year-picker";
import { dayLabel, isWeekendIso, weekdaysBetween } from "@/components/calendar/calendar-format";

interface SchoolYear {
  year: number;
  canEdit: boolean;
  publicHolidays: { date: string; name: string; observed?: boolean }[];
  closures: { id: string; name: string; startDate: string; endDate: string; reason: string | null }[];
}

/**
 * The school calendar (Phase 5b): Zambia's public holidays (from the Ministry's list) and the
 * days this school is closed. No registers are taken on either, like weekends.
 */
export default function SchoolCalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<SchoolYear | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ data: SchoolYear }>(`/calendar?year=${year}`)
      .then(({ data }) => setData(data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [year]);
  useEffect(load, [load]);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"? Registers can then be taken on those days again.`)) return;
    try {
      await api.delete(`/calendar/closures/${id}`);
      toast.success("Closure removed");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">School calendar</h1>
          <p className="text-sm text-muted-foreground">
            No registers on weekends, public holidays or days the school is closed. Lessons on those days are special classes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YearPicker year={year} onChange={(y) => { setData(null); setYear(y); }} />
          {data?.canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="mr-2 h-4 w-4" /> Close the school
            </Button>
          )}
        </div>
      </div>

      {!data || data.year !== year ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Public holidays {year}</CardTitle>
              <p className="text-xs text-muted-foreground">Set nationally. A holiday on a Sunday is also kept on the Monday after.</p>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {data.publicHolidays.map((h) => (
                  <li key={h.date} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{h.name}</span>
                    <span className="flex items-center gap-2 shrink-0 tabular-nums text-muted-foreground">
                      {isWeekendIso(h.date) && <Badge variant="outline">weekend</Badge>}
                      {dayLabel(h.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">School closed</CardTitle>
              <p className="text-xs text-muted-foreground">Mid-term breaks and other days this school is closed.</p>
            </CardHeader>
            <CardContent>
              {data.closures.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                  <CalendarOff className="h-8 w-8 opacity-30" />
                  No closures this year.
                </div>
              ) : (
                <ul className="divide-y">
                  {data.closures.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.startDate === c.endDate ? dayLabel(c.startDate) : `${dayLabel(c.startDate)} – ${dayLabel(c.endDate)}`} ·{" "}
                          {weekdaysBetween(c.startDate, c.endDate)} school day(s)
                          {c.reason ? ` · ${c.reason}` : ""}
                        </p>
                      </div>
                      {data.canEdit && (
                        <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => remove(c.id, c.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {data?.canEdit && <AddClosureDialog key={String(adding)} open={adding} onOpenChange={setAdding} onSaved={load} />}
    </div>
  );
}

function AddClosureDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) return toast.error("Name the closure (e.g. Mid-term break)");
    if (!startDate) return toast.error("Choose the first day");
    setSaving(true);
    try {
      const { data } = await api.post<{ data: { registerDaysAlreadyTaken: number } }>("/calendar/closures", {
        name: name.trim(),
        startDate,
        endDate: endDate || startDate,
        reason: reason.trim() || null,
      });
      toast.success(
        data.registerDaysAlreadyTaken
          ? `Saved. Registers already taken on ${data.registerDaysAlreadyTaken} of those day(s) stay as they are.`
          : "Saved. No registers will be taken on those days."
      );
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
          <DialogTitle>Close the school</DialogTitle>
          <DialogDescription>No daily or period registers on these days. Teachers can still ask for a special class.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cl-name">Name</Label>
            <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mid-term break" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cl-start">First day</Label>
              <Input id="cl-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-end">Last day</Label>
              <Input id="cl-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Leave the last day empty for a single day.</p>
          <div className="space-y-1.5">
            <Label htmlFor="cl-reason">Reason (optional)</Label>
            <Textarea id="cl-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
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
