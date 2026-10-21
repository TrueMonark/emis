"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { PrintLoading, PrintShell } from "@/components/finance/print-shell";
import { CollectionsTables, type CollectionsReport } from "@/components/finance/report-tables";
import { dayLabel, k } from "@/components/finance/format";

function Inner() {
  const params = useSearchParams();
  const [r, setR] = useState<CollectionsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qs = params.toString();
  useEffect(() => {
    api
      .get<{ data: CollectionsReport }>(`/finance/reports/collections?${qs}`)
      .then(({ data }) => setR(data))
      .catch((e) => setError(getErrorMessage(e)));
  }, [qs]);
  if (!r) return <PrintLoading error={error} />;
  return (
    <PrintShell schoolName={r.school.name} title="FEES COLLECTED" subtitle={`${dayLabel(r.from)} to ${dayLabel(r.to)} · total ${k(r.totals.amountNgwee)}`} generatedAt={r.generatedAt}>
      <CollectionsTables report={r} />
    </PrintShell>
  );
}

/** Printable report of money collected between two dates. */
export default function CollectionsPrintPage() {
  return (
    <Suspense fallback={<PrintLoading />}>
      <Inner />
    </Suspense>
  );
}
