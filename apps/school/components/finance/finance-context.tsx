"use client";

import { createContext, useContext } from "react";

export interface FinancePerson {
  email: string;
  displayName: string | null;
  role: string;
  schoolName: string;
  /** Finance staff: record payments, set up fees. Head/deputy: view and print only. */
  canEdit: boolean;
  isLeader: boolean;
}

const Ctx = createContext<FinancePerson | null>(null);

export const FinanceContextProvider = Ctx.Provider;

export function useFinancePerson(): FinancePerson {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFinancePerson must be used inside the finance pages");
  return v;
}
