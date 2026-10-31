"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Play, Printer, RefreshCw, Save, Send } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Label } from "@school/ui/components/label";
import { Textarea } from "@school/ui/components/textarea";
import { Skeleton } from "@school/ui/components/skeleton";
import { missingFacilities, type FacilitiesData } from "@school/shared/returns/indicators";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { OFFICE_SHORT } from "@/components/offices/office-labels";
import { FacilitiesForm } from "@/components/returns/facilities";
import { ReturnDocument } from "@/components/returns/return-document";
import { day } from "@/components/returns/format";
import type { Round, SchoolReturnView } from "@/components/returns/types";

interface MyReturn {
  round: Round;
  return: SchoolReturnView | null;
  canStart: boolean;
  canEdit: boolean;
}

/**
 * One return for the head teacher / deputy (Phase 7): start the draft (counts from the records,
 * facilities from the School profile), check and correct, submit to the DEBS.
 */
export default function SchoolReturnPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const [data, setData] = useState<MyReturn | null>(null);
  const [facilities, setFacilities] = useState<FacilitiesData | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState<null | "start" | "refresh" | "save" | "submit">(null);
  const [dirty, setDirty] = useState(false);

  const apply = (d: MyReturn) => {
    setData(d);
    setFacilities(d.return?.facilities ?? null);
    setRemarks(d.return?.remarks ?? "");
    setDirty(false);
  };

  const load = useCallback(() => {
    api
      .get<{ data: MyReturn }>(`/school/returns/${roundId}`)
      .then((r) => apply(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [roundId]);
  useEffect(load, [load]);

  const run = async (what: NonNullable<typeof busy>, fn: () => Promise<{ data: MyReturn }>, done: string) => {
    setBusy(what);
    try {
      apply((await fn()).data);
      toast.success(done);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", () => api.patch(`/school/returns/${roundId}`, { facilities, remarks: remarks || null }), "Draft saved");

  const submit = async () => {
    if (!confirm("Submit the return to the DEBS? You can't change it after this unless they send it back.")) return;
    setBusy("submit");
    try {
      if (dirty) await api.patch(`/school/returns/${roundId}`, { facilities, remarks: remarks || null });
      apply((await api.post<{ data: MyReturn }>(`/school/returns/${roundId}/submit`)).data);
      toast.success("Return submitted to the DEBS");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <Skeleton className="m-4 h-96 lg:m-0" />;
  const { round, return: ret, canEdit } = data;
  const missing = facilities ? missingFacilities(facilities) : [];

  return (
    <div className="space-y-6 p-4 lg:p-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/returns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline print:hidden">
            <ArrowLeft className="h-3 w-3" /> Returns
          </Link>
          <h1 className="text-2xl font-bold">{round.title}</h1>
          <p className="text-sm text-muted-foreground">
            From {OFFICE_SHORT[round.office.type]} {round.office.name} · period {day(round.periodStart)} to {day(round.periodEnd)} · due {day(round.dueDate)}
            {round.status === "CLOSED" && " · closed"}
          </p>
          {round.instructions && <p className="mt-1 max-w-2xl whitespace-pre-line text-sm">{round.instructions}</p>}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {ret && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  run(
                    "refresh",
                    async () => {
                      // Keep unsaved facility edits: save them before working the counts out again.
                      if (dirty) await api.patch(`/school/returns/${roundId}`, { facilities, remarks: remarks || null });
                      return api.post(`/school/returns/${roundId}/refresh`);
                    },
                    "Figures worked out again from the records"
                  )
                }
              >
                {busy === "refresh" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Refresh figures
              </Button>
              <Button variant="outline" disabled={!!busy || !dirty} onClick={save}>
                {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save draft
              </Button>
              <Button disabled={!!busy || missing.length > 0} onClick={submit}>
                {busy === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Submit to the DEBS
              </Button>
            </>
          )}
        </div>
      </div>

      {!ret ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {data.canStart ? (
              <>
                <p className="text-sm">
                  Starting the return works out the counts from the school&apos;s records (learners, teachers, registers, attendance) and copies in the
                  facilities from the School profile page. Nothing goes to the DEBS until you submit.
                </p>
                <Button
                  disabled={!!busy}
                  onClick={() => run("start", () => api.post(`/school/returns/${roundId}`), "Draft started")}
                >
                  {busy === "start" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Start the return
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">This return is closed and wasn&apos;t started.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {canEdit && missing.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 print:hidden">
              Fill in the facilities before submitting: {missing.join(", ")}.
            </div>
          )}
          <ReturnDocument
            ret={ret}
            audience="school"
            facilitiesSlot={
              canEdit && facilities ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Facilities</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Copied from the School profile when the draft started. Changes here are for this return only; update the School profile too.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <FacilitiesForm
                      value={facilities}
                      onChange={(v) => {
                        setFacilities(v);
                        setDirty(true);
                      }}
                    />
                  </CardContent>
                </Card>
              ) : undefined
            }
            remarksSlot={
              canEdit ? (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Remarks for the DEBS</CardTitle></CardHeader>
                  <CardContent>
                    <Label htmlFor="ret-remarks" className="sr-only">Remarks</Label>
                    <Textarea
                      id="ret-remarks"
                      rows={5}
                      placeholder="Anything the figures don't show (e.g. a classroom block under construction)"
                      value={remarks}
                      onChange={(e) => {
                        setRemarks(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </CardContent>
                </Card>
              ) : undefined
            }
          />
        </>
      )}
    </div>
  );
}
