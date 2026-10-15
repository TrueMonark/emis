"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Route } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Checkbox } from "@school/ui/components/checkbox";
import { Skeleton } from "@school/ui/components/skeleton";
import type { PathwayRules } from "@school/shared/curriculum/pathways";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";

interface Pathway {
  id: string;
  code: string;
  name: string;
  stage: "O_LEVEL" | "A_LEVEL";
  rules: PathwayRules;
  offered: boolean;
}

interface CatalogueEntry {
  code: string;
  name: string;
}

/**
 * Which national O-level and A-level pathways the school offers (2023 Curriculum Framework:
 * schools offer the pathways their staff, rooms and equipment allow). Shows each pathway's
 * subject rules in plain words.
 */
export function PathwaysManager({ canEdit }: { canEdit: boolean }) {
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [p, c] = await Promise.all([
        api.get<{ data: Pathway[] }>("/curriculum/pathways"),
        api.get<{ data: CatalogueEntry[] }>("/curriculum/catalogue"),
      ]);
      const list = p.data ?? [];
      setPathways(list);
      setSelected(new Set(list.filter((x) => x.offered).map((x) => x.id)));
      setNames(new Map((c.data ?? []).map((s) => [s.code, s.name])));
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load pathways"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => pathways.some((p) => p.offered !== selected.has(p.id)),
    [pathways, selected]
  );

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put<{ data: Pathway[] }>("/curriculum/pathways", {
        pathwayIds: [...selected],
      });
      const list = res.data ?? [];
      setPathways(list);
      setSelected(new Set(list.filter((x) => x.offered).map((x) => x.id)));
      toast.success("Pathways saved");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save pathways"));
    } finally {
      setSaving(false);
    }
  };

  const nameOf = (code: string) => names.get(code) ?? code;

  const describe = (rules: PathwayRules) => {
    const parts: string[] = [];
    if (rules.compulsory.length) parts.push(`Compulsory: ${rules.compulsory.map(nameOf).join(", ")}`);
    for (const r of rules.compulsoryUnlessTaking ?? []) {
      parts.push(`${nameOf(r.code)} unless taking ${nameOf(r.unless)}`);
    }
    for (const c of rules.choose) parts.push(`Plus ${c.label}`);
    parts.push(`${rules.minSubjects}–${rules.maxSubjects} subjects`);
    return parts;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  const groups: { stage: Pathway["stage"]; title: string }[] = [
    { stage: "O_LEVEL", title: "O-level pathways (Forms 1–4)" },
    { stage: "A_LEVEL", title: "A-level pathways (Forms 5–6)" },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Tick the pathways your school offers. A class can then be tied to one of them, and its
        subjects are checked against the pathway&apos;s rules (a warning, never a block).
      </p>
      {groups.map((g) => (
        <div key={g.stage} className="space-y-2">
          <p className="text-sm font-semibold">{g.title}</p>
          {pathways
            .filter((p) => p.stage === g.stage)
            .map((p) => (
              <label
                key={p.id}
                className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 lg:px-4 cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(p.id)}
                  disabled={!canEdit}
                  onCheckedChange={(v) => toggle(p.id, v === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Route className="h-3.5 w-3.5 text-muted-foreground" />
                    {p.name}
                  </p>
                  <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                    {describe(p.rules).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                    {(p.rules.notes ?? []).map((n) => (
                      <li key={n} className="italic">{n}</li>
                    ))}
                  </ul>
                </div>
              </label>
            ))}
        </div>
      ))}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save pathways"}
          </Button>
        </div>
      )}
    </div>
  );
}
