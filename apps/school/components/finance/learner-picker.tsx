"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@school/ui/components/input";
import { Button } from "@school/ui/components/button";
import { api } from "@/lib/api-client";
import { k } from "./format";
import type { LearnerRow } from "./types";

/** Find a learner by name or learner number (this year's class lists). */
export function LearnerPicker({ value, onChange }: { value: LearnerRow | null; onChange: (l: LearnerRow | null) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LearnerRow[]>([]);
  const [loading, setLoading] = useState(false);

  const searching = !value && q.trim().length >= 2;
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(() => {
      setLoading(true);
      api
        .get<{ data: LearnerRow[] }>(`/finance/learners?q=${encodeURIComponent(q.trim())}`)
        .then(({ data }) => setRows(data.slice(0, 12)))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, searching]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <div className="min-w-0">
          <p className="font-medium truncate">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            {value.classLabel} · balance {k(value.balanceNgwee)}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Choose another learner">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Type a name or learner number" value={q} onChange={(e) => setQ(e.target.value)} />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {searching && rows.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-md border">
          {rows.map((r) => (
            <button
              type="button"
              key={r.studentId}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onChange(r)}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.classLabel}
                  {r.learnerNumber ? ` · ${r.learnerNumber}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums">{k(r.balanceNgwee)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
