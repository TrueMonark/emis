"use client";

import { createContext, useContext } from "react";
import type { OfficeRole, OfficeType } from "./office-labels";

export interface CurrentOffice {
  officeId: string;
  officeName: string;
  officeType: OfficeType;
  role: OfficeRole;
  title: string | null;
}

const Ctx = createContext<CurrentOffice | null>(null);

export const OfficeContextProvider = Ctx.Provider;

/** The signed-in person's office (inside the office pages). */
export function useCurrentOffice(): CurrentOffice {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCurrentOffice must be used inside the office pages");
  return value;
}
