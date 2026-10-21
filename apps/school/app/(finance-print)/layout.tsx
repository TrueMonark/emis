"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/api-client";
import { ThemeProvider } from "@/components/layout/theme-provider";

/**
 * Print views of the school fees pages (receipts, statements, reports): plain white pages
 * without the sidebar, opened in a new tab. The data comes from the same /api/finance routes,
 * so the same people may see them.
 */
export default function FinancePrintLayout({ children }: { children: React.ReactNode }) {
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
          @page { margin: 12mm; }
          body { background: white !important; }
        }
      `}</style>
      {children}
    </div>
    </ThemeProvider>
  );
}
