"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { FinanceOptions } from "@/components/finance/types";

/** Years, terms, year levels, classes and fee kinds for the school fees pages. */
export function useFinanceOptions(): FinanceOptions | null {
  const [options, setOptions] = useState<FinanceOptions | null>(null);
  useEffect(() => {
    api
      .get<{ data: FinanceOptions }>("/finance/options")
      .then(({ data }) => setOptions(data))
      .catch(() => undefined);
  }, []);
  return options;
}
