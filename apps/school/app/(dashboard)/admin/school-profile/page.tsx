"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Label } from "@school/ui/components/label";
import { Input } from "@school/ui/components/input";
import { Textarea } from "@school/ui/components/textarea";
import { Skeleton } from "@school/ui/components/skeleton";
import { EMPTY_FACILITIES, type FacilitiesData } from "@school/shared/returns/indicators";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { CATEGORY_LABEL } from "@/components/offices/office-labels";
import { PeriodPicker, presetPeriod, type PeriodValue } from "@/components/returns/period-picker";
import { FacilitiesForm } from "@/components/returns/facilities";
import { SchoolProfileView } from "@/components/returns/school-profile-view";
import { dateTime } from "@/components/returns/format";
import type { SchoolProfile } from "@/components/returns/types";

/**
 * The school's own profile (Phase 7): the figures the DEBS sees, beside the district's, and the
 * facilities the head keeps up to date (copied into every return).
 */
export default function SchoolProfilePage() {
  const [period, setPeriod] = useState<PeriodValue>(() => presetPeriod("30"));
  const [data, setData] = useState<SchoolProfile | null>(null);
  const [facilities, setFacilities] = useState<FacilitiesData>(EMPTY_FACILITIES);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [centreCode, setCentreCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ data: SchoolProfile }>(`/school/profile?from=${period.from}&to=${period.to}`)
      .then(({ data }) => {
        setData(data);
        setFacilities(data.facilities);
        setNotes(data.facilitiesNotes ?? "");
        setCentreCode(data.school.eczCentreCode ?? "");
      })
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [period]);
  useEffect(load, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/school/profile/facilities", { ...facilities, notes: notes || null });
      toast.success("Facilities saved");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveCentreCode = async () => {
    setSavingCode(true);
    try {
      await api.put("/school/profile/centre-code", { eczCentreCode: centreCode || null });
      toast.success("ECZ centre code saved");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingCode(false);
    }
  };

  const facilitiesCard = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Facilities</CardTitle>
        <p className="text-xs text-muted-foreground">
          Keep these up to date; each new return copies them in.
          {data?.facilitiesUpdatedAt && ` Last saved ${dateTime(data.facilitiesUpdatedAt)}.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 rounded-md border p-3">
          <Label htmlFor="ecz-code">ECZ examination centre code</Label>
          <div className="flex gap-2">
            <Input id="ecz-code" value={centreCode} onChange={(e) => setCentreCode(e.target.value)} placeholder="Printed on SBA score sheets" disabled={!data?.canEdit} />
            {data?.canEdit && (
              <Button variant="outline" onClick={saveCentreCode} disabled={savingCode}>
                {savingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            )}
          </div>
        </div>
        <FacilitiesForm value={facilities} onChange={setFacilities} disabled={!data?.canEdit} />
        <div className="space-y-1">
          <Label htmlFor="fac-notes">Notes (optional)</Label>
          <Textarea id="fac-notes" rows={2} placeholder="e.g. 2 classrooms need roof repairs" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {data?.canEdit && (
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save facilities
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-4 lg:p-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">School profile</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? `${data.school.name} · ${data.school.emisNumber ? `EMIS ${data.school.emisNumber}` : "EMIS number pending"} · ${CATEGORY_LABEL[data.school.category] ?? data.school.category} · ${data.school.district}`
              : "The figures your district office sees, worked out from the school's records."}
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      {data ? <SchoolProfileView data={data} facilitiesSlot={facilitiesCard} /> : <Skeleton className="h-96" />}
    </div>
  );
}
