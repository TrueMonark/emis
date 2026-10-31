"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@school/ui/components/button";

/** ‹ 2026 › */
export function YearPicker({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label="Previous year" onClick={() => onChange(year - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="w-14 text-center font-semibold tabular-nums">{year}</span>
      <Button variant="outline" size="icon" aria-label="Next year" onClick={() => onChange(year + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
