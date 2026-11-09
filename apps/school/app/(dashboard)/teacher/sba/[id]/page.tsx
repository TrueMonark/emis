"use client";

import { useParams } from "next/navigation";
import { SbaSheetPage } from "@/components/sba/sba-sheet";

/** One SBA score sheet (Phase 9b). */
export default function SbaSheetRoute() {
  const { id } = useParams<{ id: string }>();
  return <SbaSheetPage id={id} backHref="/teacher/sba" />;
}
