"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";

export interface InstalmentDraft {
  label: string;
  dueDate: string;
  percent: string;
}

/** Payment plan: parts of the fee due by dates, adding up to 100%. Empty = all due by the due date. */
export function InstalmentsEditor({ value, onChange }: { value: InstalmentDraft[]; onChange: (v: InstalmentDraft[]) => void }) {
  const total = value.reduce((s, i) => s + (Number(i.percent) || 0), 0);
  const set = (idx: number, patch: Partial<InstalmentDraft>) => onChange(value.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">No payment plan: the whole fee is due by the due date.</p>
      ) : (
        <>
          {value.map((i, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_9rem_5rem_auto] items-center gap-2">
              <Input value={i.label} onChange={(e) => set(idx, { label: e.target.value })} placeholder={`Instalment ${idx + 1}`} />
              <Input type="date" value={i.dueDate} onChange={(e) => set(idx, { dueDate: e.target.value })} />
              <div className="relative">
                <Input inputMode="numeric" className="pr-6" value={i.percent} onChange={(e) => set(idx, { percent: e.target.value.replace(/\D/g, "") })} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(value.filter((_, j) => j !== idx))} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <p className={total === 100 ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>Total {total}% (must be 100%)</p>
        </>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...value,
            { label: `Instalment ${value.length + 1}`, dueDate: "", percent: value.length === 0 ? "50" : String(Math.max(0, 100 - total)) },
          ])
        }
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add instalment
      </Button>
    </div>
  );
}

export const toInstalments = (v: InstalmentDraft[]) =>
  v.map((i, idx) => ({ label: i.label.trim() || `Instalment ${idx + 1}`, dueDate: i.dueDate, percent: Number(i.percent) || 0 }));

export function instalmentProblem(v: InstalmentDraft[]): string | null {
  if (v.length === 0) return null;
  if (v.some((i) => !i.dueDate)) return "Give each instalment a date";
  if (v.reduce((s, i) => s + (Number(i.percent) || 0), 0) !== 100) return "The instalments must add up to 100%";
  return null;
}
