"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@school/ui/components/sidebar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { OfficeSidebar, type OfficePerson } from "@/components/offices/office-sidebar";
import { OfficeContextProvider } from "@/components/offices/office-context";
import { FlagStripe } from "@/components/offices/flag-stripe";
import { api, getAuthToken } from "@/lib/api-client";

interface Me extends OfficePerson {
  hasDefaultPassword: boolean;
  office: OfficePerson["office"] & { officeId: string };
}

/**
 * Education office pages (HQ, PEO, DEBS). Same sign-in as schools; who sees what is decided by
 * the server from the person's office role.
 */
export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = React.useState<Me | null>(null);

  React.useEffect(() => {
    if (!getAuthToken()) {
      router.replace("/login");
      return;
    }
    api
      .get<{ data: Me & { office: Me["office"] | null } }>("/auth/me")
      .then(({ data }) => {
        if (data.hasDefaultPassword) return router.replace("/change-password");
        if (!data.office) return router.replace("/login");
        setMe(data as Me);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  // The office colours (globals.css .office-theme) on <html>, so dialogs get them too.
  React.useEffect(() => {
    document.documentElement.classList.add("office-theme");
    return () => document.documentElement.classList.remove("office-theme");
  }, []);

  const signOut = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  if (!me) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="office-theme" enableSystem={false} disableTransitionOnChange>
      <OfficeContextProvider value={me.office}>
        <SidebarProvider>
          <OfficeSidebar person={me} onSignOut={signOut} />
          <SidebarInset>
            <FlagStripe />
            <header className="flex h-12 items-center gap-2 border-b px-4 lg:hidden">
              <SidebarTrigger />
              <span className="text-sm font-semibold truncate">{me.office.officeName}</span>
            </header>
            <div className="flex flex-1 flex-col p-4 lg:p-6">
              <div className="w-full max-w-6xl mx-auto">{children}</div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </OfficeContextProvider>
    </ThemeProvider>
  );
}
