"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, ClipboardCheck, ClipboardList, GraduationCap, Megaphone, School, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Skeleton } from "@school/ui/components/skeleton";
import { api } from "@/lib/api-client";
import { OFFICE_TYPE_LABEL, roleLabel, type OfficeRole, type OfficeType } from "@/components/offices/office-labels";
import { FlagStripe } from "@/components/offices/flag-stripe";
import { StatTile } from "@/components/offices/stat-tile";
import { BarList } from "@/components/offices/bar-list";
import { presetPeriod } from "@/components/returns/period-picker";
import { num, pct, per } from "@/components/returns/format";
import type { Dashboard, Round, StatusCounts } from "@/components/returns/types";
import type { OfficeListItem } from "@/components/announcements/types";

interface OfficeOverview {
  office: { id: string; type: OfficeType; name: string; code: string | null; parent: { name: string } | null; label: string };
  role: OfficeRole;
  counts: { schools: number; schoolsInSetup: number; childOffices: number; accounts: number };
}

type RoundRow = Round & { schools: number; counts: StatusCounts };

/** Below these, a school or district is listed under "Needs attention". */
const REGISTERS_TARGET = 80;
const ATTENDANCE_TARGET = 85;

/**
 * The office's overview (Phase 9a): the figures that matter for its schools in the last 30 days,
 * the districts or schools to look at, and the returns and circulars still outstanding.
 */
export default function OfficeOverviewPage() {
  const [me, setMe] = useState<OfficeOverview | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [rounds, setRounds] = useState<RoundRow[] | null>(null);
  const [notices, setNotices] = useState<OfficeListItem[] | null>(null);

  useEffect(() => {
    const p = presetPeriod("30");
    api.get<{ data: OfficeOverview }>("/office/me").then((r) => setMe(r.data)).catch(() => undefined);
    api.get<{ data: Dashboard }>(`/office/indicators?from=${p.from}&to=${p.to}`).then((r) => setDash(r.data)).catch(() => undefined);
    api.get<{ data: { rounds: RoundRow[] } }>("/office/returns").then((r) => setRounds(r.data.rounds)).catch(() => setRounds([]));
    api.get<{ data: { announcements: OfficeListItem[] } }>("/office/announcements").then((r) => setNotices(r.data.announcements)).catch(() => setNotices([]));
  }, []);

  if (!me || !dash) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const d = dash.total.derived;
  const rowKind = dash.rows[0]?.kind ?? (me.office.type === "DISTRICT" ? "SCHOOL" : me.office.type === "PROVINCIAL" ? "DISTRICT" : "PROVINCE");
  const rowWord = rowKind === "SCHOOL" ? "school" : rowKind === "DISTRICT" ? "district" : "province";
  const rowHref = (r: Dashboard["rows"][number]) => (r.kind === "SCHOOL" ? `/office/schools/${r.id}` : `/office/profiles?officeId=${r.id}`);

  const learnersBars = [...dash.rows]
    .sort((a, b) => b.summary.derived.learners - a.summary.derived.learners)
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      label: r.name,
      value: r.summary.derived.learners,
      display: num(r.summary.derived.learners),
      href: rowHref(r),
      hint: `${pct(r.summary.derived.girlsPercent)} girls, ${per(r.summary.derived.pupilTeacherRatio)} per teacher`,
    }));
  const registerBars = dash.rows
    .filter((r) => r.summary.figures.registers.expected > 0)
    .sort((a, b) => (a.summary.derived.registersPercent ?? 0) - (b.summary.derived.registersPercent ?? 0))
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      label: r.name,
      value: r.summary.derived.registersPercent,
      display: pct(r.summary.derived.registersPercent),
      href: rowHref(r),
      hint: `attendance ${pct(r.summary.derived.attendancePercent)}`,
    }));

  // What needs looking at.
  const attention: { key: string; text: string; href: string }[] = [];
  for (const r of dash.rows) {
    const reg = r.summary.derived.registersPercent;
    const att = r.summary.derived.attendancePercent;
    if (r.inSetup) attention.push({ key: `${r.id}-setup`, text: `${r.name} hasn't finished its first-time setup`, href: rowHref(r) });
    if (reg != null && reg < REGISTERS_TARGET) attention.push({ key: `${r.id}-reg`, text: `${r.name}: registers taken ${pct(reg)} (below ${REGISTERS_TARGET}%)`, href: rowHref(r) });
    if (att != null && att < ATTENDANCE_TARGET) attention.push({ key: `${r.id}-att`, text: `${r.name}: attendance ${pct(att)} (below ${ATTENDANCE_TARGET}%)`, href: rowHref(r) });
    if (r.summary.facilities.reported < r.schools) {
      attention.push({
        key: `${r.id}-fac`,
        text: r.kind === "SCHOOL" ? `${r.name} hasn't given its facilities` : `${r.name}: ${r.schools - r.summary.facilities.reported} school(s) haven't given their facilities`,
        href: rowHref(r),
      });
    }
  }

  const openRounds = (rounds ?? []).filter((r) => r.status === "OPEN");
  const waitingForDebs = openRounds.reduce((s, r) => s + r.counts.SUBMITTED, 0);
  const notYetIn = openRounds.reduce((s, r) => s + r.counts.NOT_STARTED + r.counts.DRAFT + r.counts.RETURNED, 0);
  const ackOutstanding = (notices ?? []).filter((n) => n.requiresAck && !n.withdrawnAt && n.acknowledged < n.schools);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-bold">{me.office.name}</h1>
          <p className="text-sm text-muted-foreground">
            {OFFICE_TYPE_LABEL[me.office.type]}
            {me.office.parent ? ` · under ${me.office.parent.name}` : ""} · you are {roleLabel(me.role, me.office.type).toLowerCase()} · figures for
            the last 30 days
          </p>
        </div>
        <FlagStripe className="max-w-40 rounded-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Learners" value={num(d.learners)} detail={`${pct(d.girlsPercent)} girls · ${num(dash.total.schools)} schools`} icon={Users} accent="green" href="/office/profiles" />
        <StatTile label="Teachers" value={num(d.teachers)} detail={`${per(d.pupilTeacherRatio)} learners per teacher`} icon={GraduationCap} accent="orange" href="/office/profiles" />
        <StatTile label="Attendance" value={pct(d.attendancePercent)} detail="present or late, of all register marks" icon={CalendarCheck} accent="black" href="/office/profiles" />
        <StatTile label="Registers taken" value={pct(d.registersPercent)} detail="of classes × school days" icon={ClipboardList} accent="red" href="/office/profiles" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Learners by {rowWord}</CardTitle>
            <p className="text-xs text-muted-foreground">The largest {Math.min(10, dash.rows.length)}. Hover for girls and learners per teacher.</p>
          </CardHeader>
          <CardContent>
            <BarList items={learnersBars} empty="No schools yet" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Registers taken, lowest first</CardTitle>
            <p className="text-xs text-muted-foreground">The dashed line is {REGISTERS_TARGET}%.</p>
          </CardHeader>
          <CardContent>
            <BarList items={registerBars} max={100} target={REGISTERS_TARGET} empty="No registers expected in the last 30 days" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-[var(--zm-orange)]" aria-hidden /> Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing stands out in the last 30 days.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {attention.slice(0, 12).map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} className="hover:underline">{a.text}</Link>
                  </li>
                ))}
                {attention.length > 12 && <li className="text-muted-foreground">…and {attention.length - 12} more on School profiles</li>}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <StatTile
            label="Open returns"
            value={num(openRounds.length)}
            detail={
              me.office.type === "DISTRICT"
                ? `${num(waitingForDebs)} waiting for you to check · ${num(notYetIn)} not yet submitted`
                : `${num(notYetIn)} school returns not yet submitted`
            }
            icon={ClipboardCheck}
            accent="green"
            href="/office/returns"
          />
          <StatTile
            label="Circulars to acknowledge"
            value={num(ackOutstanding.length)}
            detail={
              ackOutstanding.length
                ? `${num(ackOutstanding.reduce((s, n) => s + (n.schools - n.acknowledged), 0))} school acknowledgements outstanding`
                : "All acknowledged"
            }
            icon={Megaphone}
            accent="orange"
            href="/office/announcements"
          />
          <StatTile label="Schools" value={num(me.counts.schools)} detail={`${num(me.counts.schoolsInSetup)} still in setup`} icon={School} accent="black" href="/office/schools" />
        </div>
      </div>
    </div>
  );
}
