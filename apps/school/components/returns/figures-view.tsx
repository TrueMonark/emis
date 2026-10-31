"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@school/ui/components/table";
import {
  stageLabel,
  total,
  type DerivedIndicators,
  type MaleFemale,
  type ReturnFigures,
} from "@school/shared/returns/indicators";
import { day, num, pct, per } from "./format";

type Fmt = (n: number | null | undefined) => string;

/** The headline indicators, in the order the School Profile shows them. */
export const KEY_INDICATORS: { key: keyof DerivedIndicators; label: string; fmt: Fmt; hint?: string }[] = [
  { key: "learners", label: "Learners on roll", fmt: num },
  { key: "girlsPercent", label: "Girls", fmt: pct },
  { key: "teachers", label: "Teachers", fmt: num },
  { key: "pupilTeacherRatio", label: "Learners per teacher", fmt: per },
  { key: "qualifiedPercent", label: "Teachers with a diploma or degree", fmt: pct },
  { key: "averageClassSize", label: "Average class size", fmt: per },
  { key: "attendancePercent", label: "Attendance", fmt: pct, hint: "Present or late, out of all register marks in the period" },
  { key: "registersPercent", label: "Registers taken", fmt: pct, hint: "Class registers taken, out of classes × school days in the period" },
  { key: "repeatersPercent", label: "Repeating the year", fmt: pct },
  { key: "learnersPerClassroom", label: "Learners per classroom", fmt: per },
  { key: "learnersPerDesk", label: "Learners per desk", fmt: per },
  { key: "boysPerToilet", label: "Boys per toilet", fmt: per },
  { key: "girlsPerToilet", label: "Girls per toilet", fmt: per },
];

export function KeyIndicatorsTable({
  derived,
  compare,
  label = "This school",
}: {
  derived: DerivedIndicators;
  compare?: { label: string; derived: DerivedIndicators };
  label?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Indicator</TableHead>
          <TableHead className="text-right">{label}</TableHead>
          {compare && <TableHead className="text-right">{compare.label}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {KEY_INDICATORS.map((k) => (
          <TableRow key={k.key}>
            <TableCell>
              {k.label}
              {k.hint && <span className="block text-xs text-muted-foreground">{k.hint}</span>}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">{k.fmt(derived[k.key])}</TableCell>
            {compare && <TableCell className="text-right tabular-nums text-muted-foreground">{k.fmt(compare.derived[k.key])}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MfRow({ label, mf }: { label: string; mf: MaleFemale }) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right tabular-nums">{num(mf.male)}</TableCell>
      <TableCell className="text-right tabular-nums">{num(mf.female)}</TableCell>
      <TableCell className="text-right tabular-nums font-medium">{num(total(mf))}</TableCell>
    </TableRow>
  );
}

const MfHeader = ({ first }: { first: string }) => (
  <TableHeader>
    <TableRow>
      <TableHead>{first}</TableHead>
      <TableHead className="text-right">Boys</TableHead>
      <TableHead className="text-right">Girls</TableHead>
      <TableHead className="text-right">Total</TableHead>
    </TableRow>
  </TableHeader>
);

/** All the counts of a return (or of a dashboard group), in sections. */
export function FiguresView({ figures }: { figures: ReturnFigures }) {
  const inClasses = figures.byLevel.reduce((s, l) => s + l.male + l.female, 0);
  const notInClass = total(figures.learners) - inClasses;
  const notRecorded = figures.teachers.total - figures.teachers.male - figures.teachers.female;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Learners by year level</CardTitle>
          <p className="text-xs text-muted-foreground">In a class this academic year</p>
        </CardHeader>
        <CardContent>
          <Table>
            <MfHeader first="Year level" />
            <TableBody>
              {figures.byLevel.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">No year levels yet</TableCell>
                </TableRow>
              )}
              {figures.byLevel.map((l) => (
                <MfRow key={`${l.stage}-${l.grade}`} label={`${l.grade} · ${stageLabel(l.stage)}`} mf={l} />
              ))}
            </TableBody>
            <TableFooter>
              <MfRow label="On roll" mf={figures.learners} />
            </TableFooter>
          </Table>
          {notInClass > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">{num(notInClass)} learner(s) on roll aren&apos;t in a class this year.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coming, going and support</CardTitle>
          <p className="text-xs text-muted-foreground">
            Admissions and leavers between {day(figures.period.from)} and {day(figures.period.to)}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <MfHeader first="" />
            <TableBody>
              <MfRow label="Admitted" mf={figures.newLearners} />
              <MfRow label="Left (withdrawn or transferred out)" mf={figures.leavers} />
              <MfRow label="Repeating the year" mf={figures.repeaters} />
              <MfRow label="Orphans" mf={figures.orphans} />
              <MfRow label="Other vulnerable children" mf={figures.vulnerable} />
              <MfRow label="Special educational needs" mf={figures.specialNeeds} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Teachers</CardTitle>
          <p className="text-xs text-muted-foreground">Current teaching staff, including the head and deputy</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow><TableCell>Total</TableCell><TableCell className="text-right tabular-nums font-medium">{num(figures.teachers.total)}</TableCell></TableRow>
              <TableRow><TableCell>Men</TableCell><TableCell className="text-right tabular-nums">{num(figures.teachers.male)}</TableCell></TableRow>
              <TableRow><TableCell>Women</TableCell><TableCell className="text-right tabular-nums">{num(figures.teachers.female)}</TableCell></TableRow>
              <TableRow><TableCell>Degree or higher</TableCell><TableCell className="text-right tabular-nums">{num(figures.teachers.degree)}</TableCell></TableRow>
              <TableRow><TableCell>Diploma</TableCell><TableCell className="text-right tabular-nums">{num(figures.teachers.diploma)}</TableCell></TableRow>
              <TableRow><TableCell>Certificate</TableCell><TableCell className="text-right tabular-nums">{num(figures.teachers.certificate)}</TableCell></TableRow>
              {notRecorded > 0 && (
                <TableRow><TableCell className="text-muted-foreground">No teacher profile yet</TableCell><TableCell className="text-right tabular-nums text-muted-foreground">{num(notRecorded)}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registers and attendance</CardTitle>
          <p className="text-xs text-muted-foreground">
            School days exclude weekends, public holidays and the school&apos;s closures
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow><TableCell>Classes</TableCell><TableCell className="text-right tabular-nums">{num(figures.classes)}</TableCell></TableRow>
              <TableRow><TableCell>School days in the period</TableCell><TableCell className="text-right tabular-nums">{num(figures.registers.schoolDays)}</TableCell></TableRow>
              <TableRow><TableCell>Class registers taken</TableCell><TableCell className="text-right tabular-nums">{num(figures.registers.taken)} of {num(figures.registers.expected)}</TableCell></TableRow>
              <TableRow><TableCell>Register marks</TableCell><TableCell className="text-right tabular-nums">{num(figures.attendance.marks)}</TableCell></TableRow>
              <TableRow><TableCell>Present or late</TableCell><TableCell className="text-right tabular-nums">{num(figures.attendance.present)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
