"use client";

import { useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { dateTimeLabel } from "./format";

/** A printable page: Print button (hidden when printing), school heading, title, footer. */
export function PrintShell({
  schoolName,
  title,
  subtitle,
  generatedAt,
  children,
  narrow,
}: {
  schoolName: string;
  title: string;
  subtitle?: ReactNode;
  generatedAt?: string | Date;
  children: ReactNode;
  /** Receipt-sized page */
  narrow?: boolean;
}) {
  const [openedAt] = useState(() => new Date().toISOString());
  return (
    <div className={`mx-auto p-6 ${narrow ? "max-w-xl" : "max-w-5xl"}`}>
      <div className="no-print mb-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => window.close()}>
          Close
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>
      <header className="mb-4 border-b border-black pb-3 text-center">
        <p className="text-lg font-bold uppercase tracking-wide">{schoolName}</p>
        <p className="text-base font-semibold">{title}</p>
        {subtitle && <div className="text-sm">{subtitle}</div>}
      </header>
      <main className="[&_th]:text-black [&_td]:py-1.5 [&_th]:h-8">{children}</main>
      <footer className="mt-6 flex justify-between border-t pt-2 text-[10px] text-neutral-600">
        <span>Printed {dateTimeLabel(generatedAt ? new Date(generatedAt).toISOString() : openedAt)}</span>
        <span>Monark Devs</span>
      </footer>
    </div>
  );
}

export function PrintLoading({ error }: { error?: string | null }) {
  return <p className="p-10 text-center text-sm text-neutral-600">{error ?? "Loading…"}</p>;
}
