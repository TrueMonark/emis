"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Phone } from "lucide-react";
import { Badge } from "@school/ui/components/badge";
import { Skeleton } from "@school/ui/components/skeleton";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { CATEGORY_LABEL } from "@/components/offices/office-labels";
import { PeriodPicker, presetPeriod, type PeriodValue } from "@/components/returns/period-picker";
import { SchoolProfileView } from "@/components/returns/school-profile-view";
import type { SchoolProfile } from "@/components/returns/types";

const LEADER_LABEL: Record<string, string> = { HEAD_TEACHER: "Head teacher", ADMIN: "Head teacher", DEPUTY_HEAD: "Deputy head" };

/** One school's profile for the DEBS / PEO / HQ (Phase 7): figures beside the district's. */
export default function OfficeSchoolProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod] = useState<PeriodValue>(() => presetPeriod("30"));
  const url = `/office/schools/${id}/profile?from=${period.from}&to=${period.to}`;
  const [loaded, setLoaded] = useState<{ url: string; data: SchoolProfile } | null>(null);
  const data = loaded?.url === url ? loaded.data : null;

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: SchoolProfile }>(url)
      .then((r) => !cancelled && setLoaded({ url, data: r.data }))
      .catch((e) => toast.error(getErrorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/office/profiles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="h-3 w-3" /> School profiles
          </Link>
          {data ? (
            <>
              <h1 className="text-xl font-bold">{data.school.name}</h1>
              <p className="text-sm text-muted-foreground">
                {data.school.emisNumber ? `EMIS ${data.school.emisNumber}` : "EMIS number pending"} ·{" "}
                {CATEGORY_LABEL[data.school.category] ?? data.school.category}
                {data.school.agency ? ` (${data.school.agency})` : ""} · {data.school.district}
                {data.school.inSetup && <Badge variant="outline" className="ml-2">Still in setup</Badge>}
              </p>
              {data.leaders && data.leaders.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
                  {data.leaders.map((l) => (
                    <span key={`${l.role}-${l.name}`}>
                      {LEADER_LABEL[l.role] ?? l.role}: {l.name}
                      {l.phone && (
                        <a href={`tel:${l.phone}`} className="ml-1 inline-flex items-center gap-1 text-muted-foreground hover:underline">
                          <Phone className="h-3 w-3" /> {l.phone}
                        </a>
                      )}
                    </span>
                  ))}
                </p>
              )}
            </>
          ) : (
            <Skeleton className="mt-1 h-8 w-64" />
          )}
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      {data ? <SchoolProfileView data={data} /> : <Skeleton className="h-96" />}
    </div>
  );
}
