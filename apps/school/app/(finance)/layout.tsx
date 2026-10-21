"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@school/ui/components/sidebar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { FinanceSidebar } from "@/components/finance/finance-sidebar";
import { FinanceContextProvider, type FinancePerson } from "@/components/finance/finance-context";
import { api, getAuthToken } from "@/lib/api-client";

interface Me {
  email: string;
  displayName?: string | null;
  role: string;
  hasDefaultPassword: boolean;
  school?: { id: string; name: string; setupComplete: boolean; feesEnabled?: boolean } | null;
}

/**
 * School fees pages: finance staff (role FINANCE) do the work; the head teacher and deputy can
 * view and print. Only in schools with the fees module (private schools, or switched on by the
 * DEBS). The server checks all of this again on every request.
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [person, setPerson] = React.useState<FinancePerson | null>(null);
  const [notOn, setNotOn] = React.useState(false);

  React.useEffect(() => {
    if (!getAuthToken()) {
      router.replace("/login");
      return;
    }
    api
      .get<{ data: Me }>("/auth/me")
      .then(({ data }) => {
        if (data.hasDefaultPassword) return router.replace("/change-password");
        if (!data.school) return router.replace("/login");
        const isFinance = data.role === "FINANCE";
        const isLeader = isSchoolLeader(data.role);
        if (!isFinance && !isLeader) return router.replace(data.role === "TEACHER" ? "/teacher" : "/admin");
        if (!data.school.feesEnabled) return setNotOn(true);
        setPerson({
          email: data.email,
          displayName: data.displayName ?? null,
          role: data.role,
          schoolName: data.school.name,
          canEdit: isFinance,
          isLeader,
        });
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const signOut = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  if (notOn) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="font-medium">School fees aren&apos;t switched on for this school.</p>
        <p className="text-sm text-muted-foreground max-w-md">
          They are on for private schools. For other schools the district office (DEBS) can switch them on.
        </p>
        <button className="text-sm underline" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <FinanceContextProvider value={person}>
        <SidebarProvider>
          <FinanceSidebar person={person} onSignOut={signOut} />
          <SidebarInset>
            <header className="flex h-12 items-center gap-2 border-b px-4 lg:hidden">
              <SidebarTrigger />
              <span className="text-sm font-semibold truncate">School fees</span>
            </header>
            <div className="flex flex-1 flex-col p-4 lg:p-6">
              <div className="w-full max-w-6xl mx-auto">{children}</div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </FinanceContextProvider>
    </ThemeProvider>
  );
}
