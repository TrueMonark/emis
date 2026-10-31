"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Building2, ClipboardCheck, School, Users, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import { api } from "@/lib/api-client";
import { OFFICE_TYPE_LABEL, roleLabel, type OfficeRole, type OfficeType } from "@/components/offices/office-labels";

interface OfficeOverview {
  office: { id: string; type: OfficeType; name: string; code: string | null; parent: { name: string } | null; label: string };
  role: OfficeRole;
  counts: { schools: number; schoolsInSetup: number; childOffices: number; accounts: number };
}

const WHAT_YOU_CAN_DO: Record<OfficeType, string[]> = {
  HQ: [
    "See every province's school profile figures, and open returns for all schools.",
    "Create accounts for the provincial offices (and anywhere else).",
    "Add district offices to any province, and move schools to their right district.",
    "See every school, office and audit line in the country.",
  ],
  PROVINCIAL: [
    "See your districts' school profile figures, and open returns for your province's schools.",
    "Add the district offices of your province.",
    "Create the DEBS accounts for those districts.",
    "Move schools in your province (or 'not yet assigned') to the right district.",
  ],
  DISTRICT: [
    "See each school's profile figures, open returns, and approve or send back the returns your schools submit.",
    "Register the schools of your district, each with its first head teacher.",
    "Keep EMIS numbers right (confirm, correct or mark as disputed).",
    "Add officers to your office.",
  ],
};

export default function OfficeOverviewPage() {
  const [data, setData] = useState<OfficeOverview | null>(null);

  useEffect(() => {
    api.get<{ data: OfficeOverview }>("/office/me").then((r) => setData(r.data)).catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const tiles = [
    { label: "Schools", value: data.counts.schools, icon: School, href: "/office/schools" },
    { label: "Schools still in setup", value: data.counts.schoolsInSetup, icon: Wrench, href: "/office/schools" },
    { label: data.office.type === "DISTRICT" ? "Other offices" : "Offices below", value: data.counts.childOffices, icon: Building2, href: "/office/offices" },
    { label: "Office accounts", value: data.counts.accounts, icon: Users, href: "/office/offices" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{data.office.name}</h1>
        <p className="text-sm text-muted-foreground">
          {OFFICE_TYPE_LABEL[data.office.type]}
          {data.office.parent ? ` · under ${data.office.parent.name}` : ""} · you are{" "}
          {roleLabel(data.role, data.office.type).toLowerCase()}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="hover:bg-muted/40 transition-colors">
              <CardContent className="flex items-center gap-3 p-4">
                <t.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{t.value}</p>
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/office/profiles">
          <Card className="hover:bg-muted/40 transition-colors">
            <CardContent className="flex items-center gap-3 p-4">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">School profiles</p>
                <p className="text-xs text-muted-foreground">Learners, teachers, registers, attendance and facilities, school by school</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/office/returns">
          <Card className="hover:bg-muted/40 transition-colors">
            <CardContent className="flex items-center gap-3 p-4">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Returns</p>
                <p className="text-xs text-muted-foreground">Ask schools for their figures and check what they submit</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What your office does here</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {WHAT_YOU_CAN_DO[data.office.type].map((line) => <li key={line}>{line}</li>)}
          </ul>
          {data.role === "OFFICER" && (
            <p className="mt-3 text-sm text-muted-foreground">
              As an officer you can see everything above; the head of the office makes the changes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
