"use client";

import { ArrowRightLeft, Building2, FileClock, Home, KeyRound, LogOut, School } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@school/ui/components/sidebar";
import { NavMain, type NavGroup } from "@/components/layout/nav-main";
import { OFFICE_SHORT, roleLabel, type OfficeRole, type OfficeType } from "./office-labels";

export interface OfficePerson {
  email: string;
  displayName?: string | null;
  office: { officeName: string; officeType: OfficeType; role: OfficeRole; title: string | null };
}

const groups: NavGroup[] = [
  {
    label: "Office",
    items: [
      { title: "Overview", url: "/office", icon: Home },
      { title: "Schools", url: "/office/schools", icon: School },
      { title: "Offices & accounts", url: "/office/offices", icon: Building2 },
      { title: "Requests", url: "/office/requests", icon: KeyRound },
      { title: "Transfers", url: "/office/transfers", icon: ArrowRightLeft },
      { title: "Audit log", url: "/office/audit", icon: FileClock },
    ],
  },
];

/** Sidebar for education office staff (HQ, PEO, DEBS). */
export function OfficeSidebar({ person, onSignOut }: { person: OfficePerson; onSignOut: () => void }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/office">
                {/* eslint-disable-next-line @next/next/no-img-element -- small static brand mark */}
                <img src="/brand/monark-devs-mark.png" alt="Monark Devs" width={32} height={32} className="size-8 shrink-0 rounded-full" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold" title={person.office.officeName}>
                    {person.office.officeName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {OFFICE_SHORT[person.office.officeType]} · Monark Devs
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 py-1.5 text-xs">
              <p className="font-medium truncate">{person.displayName || person.email}</p>
              <p className="text-muted-foreground truncate">
                {person.office.title || roleLabel(person.office.role, person.office.officeType)}
              </p>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
