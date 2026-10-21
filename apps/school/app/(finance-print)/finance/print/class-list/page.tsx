"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { PrintLoading, PrintShell } from "@/components/finance/print-shell";
import { ClassListTable, type ClassListReport } from "@/components/finance/report-tables";

function Inner() {
  const params = useSearchParams();
  const [r, setR] = useState<ClassListReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qs = params.toString();
  useEffect(() => {
    api
      .get<{ data: ClassListReport }>(`/finance/reports/class-list?${qs}`)
      .then(({ data }) => setR(data))
      .catch((e) => setError(getErrorMessage(e)));
  }, [qs]);
  if (!r) return <PrintLoading error={error} />;
  return (
    <PrintShell schoolName={r.school.name} title="CLASS LIST WITH FEES PAYMENTS" subtitle={`${r.classLabel} · ${r.year}`} generatedAt={r.generatedAt}>
      <ClassListTable report={r} />
    </PrintShell>
  );
}

/** Printable class list with each learner's payments on the side. */
export default function ClassListPrintPage() {
  return (
    <Suspense fallback={<PrintLoading />}>
      <Inner />
    </Suspense>
  );
}
