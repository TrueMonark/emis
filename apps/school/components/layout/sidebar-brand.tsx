"use client";

import { SCHOOL_NAME_NOT_SET } from "@school/shared/format";
import { useSchoolName } from "@/hooks/useSchoolIdentity";

/**
 * Top-left of every sidebar: the Monark Devs mark, the name of the school the person is signed
 * in to, and "Monark Devs" underneath.
 */
export function SidebarBrand() {
  const { name, loaded } = useSchoolName();

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- small static brand mark */}
      <img
        src="/brand/monark-devs-mark.png"
        alt="Monark Devs"
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full group-hover/header:opacity-0 transition-opacity"
      />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-semibold" title={name ?? undefined}>
          {loaded ? name ?? SCHOOL_NAME_NOT_SET : " "}
        </span>
        <span className="truncate text-xs text-muted-foreground">Monark Devs</span>
      </div>
    </>
  );
}
