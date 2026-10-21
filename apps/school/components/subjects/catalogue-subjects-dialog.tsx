"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@school/ui/components/dialog";
import { Button } from "@school/ui/components/button";
import { Checkbox } from "@school/ui/components/checkbox";
import { Input } from "@school/ui/components/input";
import { Badge } from "@school/ui/components/badge";
import { Skeleton } from "@school/ui/components/skeleton";
import { STAGE_LABELS, type YearStage } from "@school/shared/curriculum/year-levels";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";

interface CatalogueEntry {
  id: string;
  code: string;
  name: string;
  groupName: string;
  stages: YearStage[];
  periodsPerWeek: Partial<Record<YearStage, number>> | null;
  compulsoryOLevel: boolean;
  schoolSubject: { id: string; name: string; code: string } | null;
}

/**
 * "Add from national catalogue": the 2023 Curriculum Framework subject list, grouped. Ticked
 * subjects become school subjects linked to the national entry (same code and name). Subjects
 * the school already offers are shown as such.
 */
export function CatalogueSubjectsDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}) {
  const [entries, setEntries] = useState<CatalogueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setQuery("");
    setLoading(true);
    api
      .get<{ data: CatalogueEntry[] }>("/curriculum/catalogue")
      .then((res) => setEntries(res.data ?? []))
      .catch((err) => toast.error(getErrorMessage(err, "Couldn't load the national catalogue")))
      .finally(() => setLoading(false));
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, CatalogueEntry[]>();
    for (const e of entries) {
      if (q && !e.name.toLowerCase().includes(q) && !e.code.toLowerCase().includes(q)) continue;
      const list = map.get(e.groupName) ?? [];
      list.push(e);
      map.set(e.groupName, list);
    }
    return [...map.entries()];
  }, [entries, query]);

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const add = async () => {
    setSaving(true);
    try {
      const res = await api.post<{ data: { added: string[]; linked: string[]; skipped: string[] } }>(
        "/curriculum/catalogue",
        { catalogueSubjectIds: [...selected] }
      );
      const { added = [], linked = [], skipped = [] } = res.data ?? {};
      const parts = [
        added.length ? `Added ${added.length}` : "",
        linked.length ? `linked ${linked.length} existing` : "",
        skipped.length ? `skipped ${skipped.join(", ")}` : "",
      ].filter(Boolean);
      toast.success(parts.join("; ") || "Nothing to add");
      onAdded?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't add those subjects"));
    } finally {
      setSaving(false);
    }
  };

  const periodsText = (e: CatalogueEntry) => {
    const p = e.periodsPerWeek;
    if (!p) return "";
    const bits = [
      p.O_LEVEL != null ? `O-level ${p.O_LEVEL}` : "",
      p.A_LEVEL != null ? `A-level ${p.A_LEVEL}` : "",
    ].filter(Boolean);
    return bits.length ? `${bits.join(", ")} periods/week` : "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add subjects from the national catalogue</DialogTitle>
          <DialogDescription>
            The subjects of the 2023 Curriculum Framework. Tick the ones your school offers; each
            becomes a school subject linked to the national list. Local subjects can still be added
            with &quot;Add Subject&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search subjects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* A plain scrolling box: the Radix ScrollArea only scrolls with a fixed height, so with a
            max-height the list was cut off and couldn't be scrolled. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain -mx-1 px-1 max-h-[55vh]">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {groups.map(([group, list]) => (
                <div key={group} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                  {list.map((e) => {
                    const offered = !!e.schoolSubject;
                    return (
                      <label
                        key={e.id}
                        className="flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer data-[offered=true]:opacity-70"
                        data-offered={offered}
                      >
                        <Checkbox
                          checked={offered || selected.has(e.id)}
                          disabled={offered}
                          onCheckedChange={(v) => toggle(e.id, v === true)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {e.name} <span className="text-xs text-muted-foreground">· {e.code}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.stages.map((s) => STAGE_LABELS[s]).join(", ")}
                            {periodsText(e) ? ` · ${periodsText(e)}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {e.compulsoryOLevel && <Badge variant="secondary">Compulsory at O-level</Badge>}
                          {offered && <Badge variant="outline">Offered as {e.schoolSubject!.name}</Badge>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={add} disabled={saving || selected.size === 0}>
            {saving ? "Adding…" : `Add ${selected.size || ""} subject${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
