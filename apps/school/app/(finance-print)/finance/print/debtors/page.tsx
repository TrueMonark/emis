"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import { PrintLoading, PrintShell } from "@/components/finance/print-shell";
import { DebtorsTable, type DebtorsReport } from "@/components/finance/report-tables";

function Inner() {
  const params = useSearchParams();
  const [r, setR] = useState<DebtorsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qs = params.toString();
  useEffect(() => {
    api
      .get<{ data: DebtorsReport }>(`/finance/reports/debtors?${qs}`)
      .then(({ data }) => setR(data))
      .catch((e) => setError(getErrorMessage(e)));
  }, [qs]);
  if (!r) return <PrintLoading error={error} />;
  return (
    <PrintShell schoolName={r.school.name} title="LEARNERS OWING FEES" subtitle={params.get("overdue") === "1" ? "Overdue balances" : "All balances"} generatedAt={r.generatedAt}>
      <DebtorsTable report={r} />
    </PrintShell>
  );
}

/** Printable list of who owes, largest balance first. */
export default function DebtorsPrintPage() {
  return (
    <Suspense fallback={<PrintLoading />}>
      <Inner />
    </Suspense>
  );
}
