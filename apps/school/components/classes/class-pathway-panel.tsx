"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@school/ui/components/select";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";

interface OfferedPathway {
  id: string;
  name: string;
  stage: string;
  offered: boolean;
}

interface PathwayCheck {
  pathway: { id: string; name: string; code: string } | null;
  warnings: string[];
  localSubjects: string[];
}

const NONE = "__none__";

/**
 * A class's pathway (O-level / A-level classes) and whether its subjects fit the pathway's
 * rules. Only shown for year levels at those stages. Warnings never block anything.
 */
export function ClassPathwayPanel({
  classId,
  stage,
  canEdit,
}: {
  classId: string;
  stage?: string | null;
  canEdit: boolean;
}) {
  const [pathways, setPathways] = useState<OfferedPathway[]>([]);
  const [check, setCheck] = useState<PathwayCheck | null>(null);
  const [saving, setSaving] = useState(false);

  const relevant = stage === "O_LEVEL" || stage === "A_LEVEL";

  const load = useCallback(async () => {
    if (!relevant) return;
    try {
      const [p, c] = await Promise.all([
        api.get<{ data: OfferedPathway[] }>("/curriculum/pathways"),
        api.get<{ data: PathwayCheck }>(`/classes/${classId}/pathway-check`),
      ]);
      setPathways((p.data ?? []).filter((x) => x.offered && x.stage === stage));
      setCheck(c.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load the class pathway"));
    }
  }, [classId, stage, relevant]);

  useEffect(() => {
    load();
  }, [load]);

  if (!relevant) return null;

  const change = async (value: string) => {
    setSaving(true);
    try {
      await api.put(`/classes/${classId}/pathway`, { pathwayId: value === NONE ? null : value });
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't set the pathway"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="col-span-2 space-y-2">
      <label className="text-xs text-muted-foreground">Pathway</label>
      {canEdit ? (
        <Select value={check?.pathway?.id ?? NONE} onValueChange={change} disabled={saving}>
          <SelectTrigger className="w-full h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No pathway</SelectItem>
            {pathways.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm font-medium">{check?.pathway?.name ?? "No pathway"}</p>
      )}
      {canEdit && pathways.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Choose the pathways the school offers under Settings → Academic calendar → Pathways.
        </p>
      )}
      {check?.pathway &&
        (check.warnings.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            The class&apos;s subjects fit this pathway.
          </p>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Doesn&apos;t fully match the pathway
            </p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {check.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            {check.localSubjects.length > 0 && (
              <p className="mt-1">
                Not on the national list (not counted): {check.localSubjects.join(", ")}
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
