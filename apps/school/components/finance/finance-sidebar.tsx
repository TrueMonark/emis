"use client";

import { ArrowLeft, BadgePercent, Megaphone, FileBarChart, Home, LogOut, Receipt, ReceiptText, UserCog, Users } from "lucide-react";
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
import { useAnnouncementCounts } from "@/hooks/useAnnouncementCounts";
import type { FinancePerson } from "./finance-context";

/** Sidebar of the school fees pages (finance staff; the head teacher and deputy read-only). */
export function FinanceSidebar({ person, onSignOut }: { person: FinancePerson; onSignOut: () => void }) {
  const { attention } = useAnnouncementCounts();
  const groups: NavGroup[] = [
    {
      label: "School fees",
      items: [
        { title: "Overview", url: "/finance", icon: Home },
        { title: "Fees & events", url: "/finance/fees", icon: ReceiptText },
        { title: "Learners", url: "/finance/learners", icon: Users },
        { title: "Payments", url: "/finance/payments", icon: Receipt },
        { title: "Discounts & bursaries", url: "/finance/discounts", icon: BadgePercent },
        { title: "Reports", url: "/finance/reports", icon: FileBarChart },
        ...(person.isLeader ? [{ title: "Finance staff", url: "/finance/staff", icon: UserCog }] : []),
        { title: "Announcements", url: "/finance/announcements", icon: Megaphone, badge: attention },
      ],
    },
  ];
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/finance">
                {/* eslint-disable-next-line @next/next/no-img-element -- small static brand mark */}
                <img src="/brand/monark-devs-mark.png" alt="Monark Devs" width={32} height={32} className="size-8 shrink-0 rounded-full" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold" title={person.schoolName}>
                    {person.schoolName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">School fees · Monark Devs</span>
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
              <p className="text-muted-foreground truncate">{person.canEdit ? "Finance office" : "Head teacher / deputy (view only)"}</p>
            </div>
          </SidebarMenuItem>
          {person.isLeader && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/admin">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to school pages</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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
