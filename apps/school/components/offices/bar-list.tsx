"use client";

import Link from "next/link";

export interface BarItem {
  id: string;
  label: string;
  value: number | null;
  /** Shown at the end of the row, e.g. "92.5%" or "1,240" */
  display: string;
  href?: string;
  /** Extra line in the hover text */
  hint?: string;
}

/**
 * A ranked list of horizontal bars (one series, flag green), with the value written beside each
 * bar so nothing depends on colour. `max` fixes the scale (100 for percentages); `target` draws a
 * thin dashed marker, e.g. 80% of registers taken.
 */
export function BarList({ items, max, target, empty = "Nothing to show yet" }: { items: BarItem[]; max?: number; target?: number; empty?: string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value ?? 0));
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => {
        const width = i.value == null ? 0 : Math.max(0, Math.min(100, (i.value / top) * 100));
        const row = (
          <div className="group grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 rounded px-1 py-0.5 hover:bg-muted/50" title={`${i.label}: ${i.display}${i.hint ? ` · ${i.hint}` : ""}`}>
            <span className="truncate text-sm">{i.label}</span>
            <span className="relative h-2.5 rounded-full bg-muted">
              <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--zm-green)]" style={{ width: `${width}%` }} />
              {target != null && (
                <span className="absolute -inset-y-1 w-0 border-l border-dashed border-foreground/50" style={{ left: `${(target / top) * 100}%` }} aria-hidden />
              )}
            </span>
            <span className="w-16 text-right text-sm tabular-nums">{i.display}</span>
          </div>
        );
        return <li key={i.id}>{i.href ? <Link href={i.href}>{row}</Link> : row}</li>;
      })}
    </ul>
  );
}
