"use client";

import { useState } from "react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";

export interface PeriodValue {
  from: string;
  to: string;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function presetPeriod(preset: "30" | "90" | "year"): PeriodValue {
  const today = new Date();
  if (preset === "year") return { from: `${today.getFullYear()}-01-01`, to: iso(today) };
  const from = new Date(today);
  from.setDate(from.getDate() - (Number(preset) - 1));
  return { from: iso(from), to: iso(today) };
}

/** Last 30 days / last 90 days / this year / chosen dates — the period for attendance and movement. */
export function PeriodPicker({ value, onChange }: { value: PeriodValue; onChange: (v: PeriodValue) => void }) {
  const [mode, setMode] = useState<"30" | "90" | "year" | "custom">("30");
  const [draft, setDraft] = useState(value);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        value={mode}
        onValueChange={(m) => {
          const next = m as typeof mode;
          setMode(next);
          if (next !== "custom") onChange(presetPeriod(next));
          else setDraft(value);
        }}
      >
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
          <SelectItem value="year">This year so far</SelectItem>
          <SelectItem value="custom">Choose dates…</SelectItem>
        </SelectContent>
      </Select>
      {mode === "custom" && (
        <>
          <Input type="date" className="w-40" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          <Input type="date" className="w-40" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          <Button variant="outline" onClick={() => draft.from && draft.to && onChange(draft)}>Show</Button>
        </>
      )}
    </div>
  );
}
