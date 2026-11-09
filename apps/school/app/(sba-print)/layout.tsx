"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/api-client";
import { ThemeProvider } from "@/components/layout/theme-provider";

/**
 * The printed SBA score sheet (Phase 9b): a plain white landscape page without the sidebar,
 * opened in a new tab. The data comes from /api/sba, so only the people who may see the sheet
 * can print it.
 */
export default function SbaPrintLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  React.useEffect(() => {
    if (!getAuthToken()) router.replace("/login");
  }, [router]);
  return (
    <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
      <div className="min-h-screen bg-white text-black">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            @page { size: A4 landscape; margin: 8mm; }
            body { background: white !important; }
          }
        `}</style>
        {children}
      </div>
    </ThemeProvider>
  );
}
