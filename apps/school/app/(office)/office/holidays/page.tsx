"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Undo2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Badge } from "@school/ui/components/badge";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Skeleton } from "@school/ui/components/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { RadioGroup, RadioGroupItem } from "@school/ui/components/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@school/ui/components/dialog";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { YearPicker } from "@/components/calendar/year-picker";
import { dayLabel, isWeekendIso } from "@/components/calendar/calendar-format";

interface Holiday {
  date: string;
  name: string;
  observed?: boolean;
}
interface NationalYear {
  year: number;
  canEdit: boolean;
  builtIn: Holiday[];
  changes: { id: string; date: string; kind: "ADD" | "CANCEL"; name: string; reason: string | null }[];
  holidays: Holiday[];
}

/**
 * National public holidays (Phase 5b). The list follows the Public Holidays Act; HQ adds days
 * the President declares and cancels days that no longer apply. Every school's registers follow it.
 */
export default function PublicHolidaysPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<NationalYear | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ data: NationalYear }>(`/office/public-holidays?year=${year}`)
      .then(({ data }) => setData(data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [year]);
  useEffect(load, [load]);

  const undo = async (id: string, label: string) => {
    if (!confirm(`Undo "${label}" for every school?`)) return;
    try {
      await api.delete(`/office/public-holidays/${id}`);
      toast.success("Undone");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const change = (date: string) => data?.changes.find((c) => c.date === date);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Public holidays</h1>
          <p className="text-sm text-muted-foreground">
            No school registers are taken on these days. {data?.canEdit ? "Add a day the President declares, or cancel one that no longer applies." : "Changed by Ministry HQ."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YearPicker year={year} onChange={(y) => { setData(null); setYear(y); }} />
          {data?.canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="mr-2 h-4 w-4" /> Change
            </Button>
          )}
        </div>
      </div>
      {!data || data.year !== year ? (
        <Skeleton className="h-96" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {[...data.holidays, ...data.changes.filter((c) => c.kind === "CANCEL").map((c) => ({ date: c.date, name: c.name }))]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h) => {
                  const c = change(h.date);
                  return (
                    <li key={h.date} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className={c?.kind === "CANCEL" ? "text-muted-foreground line-through" : undefined}>
                        {h.name}
                        {c?.kind === "ADD" && <Badge className="ml-2" variant="secondary">declared</Badge>}
                        {c?.kind === "CANCEL" && <Badge className="ml-2" variant="outline">cancelled</Badge>}
                        {c?.reason && <span className="block text-xs text-muted-foreground no-underline">{c.reason}</span>}
                      </span>
                      <span className="flex items-center gap-2 shrink-0 tabular-nums text-muted-foreground">
                        {isWeekendIso(h.date) && <Badge variant="outline">weekend</Badge>}
                        {dayLabel(h.date)}
                        {c && data.canEdit && (
                          <Button variant="ghost" size="icon" aria-label="Undo" title="Undo this change" onClick={() => undo(c.id, c.name)}>
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>
      )}
      {data?.canEdit && <ChangeDialog key={String(adding)} open={adding} onOpenChange={setAdding} builtIn={data.builtIn} onSaved={load} />}
    </div>
  );
}

function ChangeDialog({ open, onOpenChange, builtIn, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; builtIn: Holiday[]; onSaved: () => void }) {
  const [kind, setKind] = useState<"ADD" | "CANCEL">("ADD");
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [cancelDate, setCancelDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const d = kind === "ADD" ? date : cancelDate;
    if (!d) return toast.error(kind === "ADD" ? "Choose the date" : "Choose the holiday");
    setSaving(true);
    try {
      await api.post("/office/public-holidays", {
        date: d,
        kind,
        name: kind === "ADD" ? name.trim() : builtIn.find((h) => h.date === d)?.name ?? "Holiday",
        reason: reason.trim() || null,
      });
      toast.success(kind === "ADD" ? "Holiday added for every school" : "Holiday cancelled for every school");
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
          <DialogTitle>Change the public holidays</DialogTitle>
          <DialogDescription>Applies to every school straight away, and is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as "ADD" | "CANCEL")} className="space-y-1">
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="ADD" /> Declare an extra holiday
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="CANCEL" /> Cancel a holiday in the list
            </label>
          </RadioGroup>
          {kind === "ADD" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ph-date">Date</Label>
                <Input id="ph-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph-name">Name</Label>
                <Input id="ph-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. General election day" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Holiday</Label>
              <Select value={cancelDate} onValueChange={setCancelDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {builtIn.map((h) => (
                    <SelectItem key={h.date} value={h.date}>
                      {h.name} — {dayLabel(h.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ph-reason">Authority (e.g. Statutory Instrument, Presidential declaration)</Label>
            <Textarea id="ph-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
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
