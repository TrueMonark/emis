"use client";

import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@school/ui/components/select";
import { Table, TableBody, TableCell, TableRow } from "@school/ui/components/table";
import {
  POWER_SOURCE_LABELS,
  POWER_SOURCES,
  WATER_SOURCE_LABELS,
  WATER_SOURCES,
  type FacilitiesData,
  type FacilitiesSummary,
  type PowerSourceValue,
  type WaterSourceValue,
} from "@school/shared/returns/indicators";
import { num } from "./format";

const COUNTS: { key: "classrooms" | "desks" | "toiletsBoys" | "toiletsGirls" | "toiletsStaff"; label: string; hint?: string }[] = [
  { key: "classrooms", label: "Classrooms", hint: "Rooms used for teaching" },
  { key: "desks", label: "Desks", hint: "Learners' desks in usable condition" },
  { key: "toiletsBoys", label: "Toilets for boys", hint: "Pit latrines or flush toilets" },
  { key: "toiletsGirls", label: "Toilets for girls" },
  { key: "toiletsStaff", label: "Toilets for staff" },
];

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/** Fields for a school's facilities (School profile page and a return's draft). */
export function FacilitiesForm({
  value,
  onChange,
  disabled,
}: {
  value: FacilitiesData;
  onChange: (v: FacilitiesData) => void;
  disabled?: boolean;
}) {
  const setCount = (key: (typeof COUNTS)[number]["key"], raw: string) => {
    const trimmed = raw.trim();
    const n = trimmed === "" ? null : Math.max(0, Math.floor(Number(trimmed)));
    onChange({ ...value, [key]: n === null || Number.isNaN(n) ? null : n });
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {COUNTS.map((c) => (
        <div key={c.key} className="space-y-1">
          <Label htmlFor={`fac-${c.key}`}>{c.label}</Label>
          <Input
            id={`fac-${c.key}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={value[c.key] ?? ""}
            onChange={(e) => setCount(c.key, e.target.value)}
            disabled={disabled}
          />
          {c.hint && <p className="text-xs text-muted-foreground">{c.hint}</p>}
        </div>
      ))}
      <div className="space-y-1">
        <Label>Main water source</Label>
        <Select
          value={value.waterSource ?? ""}
          onValueChange={(v) => onChange({ ...value, waterSource: v as WaterSourceValue })}
          disabled={disabled}
        >
          <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
          <SelectContent>
            {WATER_SOURCES.map((w) => <SelectItem key={w} value={w}>{WATER_SOURCE_LABELS[w]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Electricity</Label>
        <Select
          value={value.power ?? ""}
          onValueChange={(v) => onChange({ ...value, power: v as PowerSourceValue })}
          disabled={disabled}
        >
          <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
          <SelectContent>
            {POWER_SOURCES.map((p) => <SelectItem key={p} value={p}>{POWER_SOURCE_LABELS[p]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Internet at the school</Label>
        <Select
          value={value.internet == null ? "" : value.internet ? "yes" : "no"}
          onValueChange={(v) => onChange({ ...value, internet: v === "yes" })}
          disabled={disabled}
        >
          <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
          <SelectContent>
            {YES_NO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** One school's facilities, read-only. */
export function FacilitiesView({ value }: { value: FacilitiesData }) {
  const rows: [string, string][] = [
    ...COUNTS.map((c): [string, string] => [c.label, num(value[c.key])]),
    ["Main water source", value.waterSource ? WATER_SOURCE_LABELS[value.waterSource] : "–"],
    ["Electricity", value.power ? POWER_SOURCE_LABELS[value.power] : "–"],
    ["Internet", value.internet == null ? "–" : value.internet ? "Yes" : "No"],
  ];
  return (
    <Table>
      <TableBody>
        {rows.map(([k, v]) => (
          <TableRow key={k}>
            <TableCell>{k}</TableCell>
            <TableCell className="text-right tabular-nums">{v}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Facilities added up over many schools. */
export function FacilitiesSummaryView({ value }: { value: FacilitiesSummary }) {
  const list = <T extends string>(counts: Partial<Record<T, number>>, labels: Record<T, string>) =>
    (Object.keys(counts) as T[]).length === 0
      ? "–"
      : (Object.entries(counts) as [T, number][]).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${labels[k]}: ${n}`).join(" · ");
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {value.reported} of {value.schools} school(s) have given their facilities; the totals are theirs.
      </p>
      <Table>
        <TableBody>
          <TableRow><TableCell>Classrooms</TableCell><TableCell className="text-right tabular-nums">{num(value.classrooms)}</TableCell></TableRow>
          <TableRow><TableCell>Desks</TableCell><TableCell className="text-right tabular-nums">{num(value.desks)}</TableCell></TableRow>
          <TableRow><TableCell>Toilets for boys / girls / staff</TableCell><TableCell className="text-right tabular-nums">{num(value.toiletsBoys)} / {num(value.toiletsGirls)} / {num(value.toiletsStaff)}</TableCell></TableRow>
          <TableRow><TableCell>Water</TableCell><TableCell className="text-right text-sm">{list(value.water, WATER_SOURCE_LABELS)}</TableCell></TableRow>
          <TableRow><TableCell>Electricity</TableCell><TableCell className="text-right text-sm">{list(value.power, POWER_SOURCE_LABELS)}</TableCell></TableRow>
          <TableRow><TableCell>Schools with internet</TableCell><TableCell className="text-right tabular-nums">{num(value.internet)}</TableCell></TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
