"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";
import type { SbaMark, SbaScoreSheet } from "@/components/sba/types";

const TASKS = [1, 2, 3, 4, 5, 6];
const TERM_OF = (n: number) => `T${Math.ceil(n / 2)}`;
const show = (m: SbaMark | null | undefined) => (!m ? "" : m.isAbsent ? "A" : m.marks == null ? "" : String(m.marks));

function Line({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={`flex items-end gap-2 ${wide ? "col-span-2" : ""}`}>
      <span className="whitespace-nowrap text-[11px] font-semibold">{label}</span>
      <span className="flex-1 border-b border-dotted border-black pb-0.5 text-[11px]">{value || " "}</span>
    </div>
  );
}

/**
 * The SBA score sheet to print, sign and stamp (Phase 9b): the layout of the ECZ score sheet
 * (the earlier year level's six tasks, this year's six tasks, the total and the teacher's
 * comment), without ECZ's logos, which belong to ECZ.
 */
export default function SbaScoreSheetPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<SbaScoreSheet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: SbaScoreSheet }>(`/sba/${id}/score-sheet`)
      .then((r) => setS(r.data))
      .catch((e) => setError(getErrorMessage(e)));
  }, [id]);

  if (!s) return <p className="p-8 text-sm">{error ?? "Loading…"}</p>;

  // The earlier year level's tasks come from last year's sheet. With none (the learners' first SBA
  // year), this year's tasks go on the left and the next year's columns stay empty, as on paper.
  const hasEarlier = !!s.levels.earlier;
  const leftLabel = hasEarlier ? s.levels.earlier! : s.levels.current;
  const rightLabel = hasEarlier ? s.levels.current : "Next year";
  const leftMax = hasEarlier ? s.earlierTasks : s.currentTasks;
  const rightMax = hasEarlier ? s.currentTasks : null;
  const maxOf = (list: { number: number; maxMarks: number }[] | null, n: number) => list?.find((t) => t.number === n)?.maxMarks;

  return (
    <div className="mx-auto max-w-[1120px] p-4 text-black">
      <div className="no-print mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {s.status === "CONFIRMED" ? `Confirmed by the head teacher${s.confirmedAt ? ` on ${new Date(s.confirmedAt).toLocaleDateString("en-GB")}` : ""}.` : "Not yet confirmed by the head teacher: this is a working copy."}
          {" "}Print in landscape.
        </p>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <div className="border-b-4 border-[#198a00] pb-2 text-center">
        <p className="text-lg font-extrabold tracking-wide">SCHOOL BASED ASSESSMENT (SBA) SCORE SHEET</p>
        <p className="text-base font-bold uppercase">{s.subject.name}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-10 gap-y-1.5">
        <Line label="Centre/School Name:" value={s.school.name} />
        <Line label="Centre Code:" value={s.school.centreCode} />
        <Line label="Subject Name:" value={s.subject.name} />
        <Line label="Subject Code:" value={s.subject.code} />
        <Line label="Province:" value={s.school.province} />
        <Line label="District:" value={s.school.district} />
        <Line label="Form:" value={hasEarlier ? `${s.levels.earlier} & ${s.levels.current}` : s.levels.current} />
        <Line label="Year:" value={String(s.year)} />
      </div>

      <table className="mt-3 w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th rowSpan={2} className="border border-black bg-sky-100 px-1">S/N</th>
            <th rowSpan={2} className="border border-black bg-sky-100 px-1">Learner&apos;s Name</th>
            <th rowSpan={2} className="border border-black bg-sky-100 px-1">Examination Number</th>
            <th colSpan={7} className="border border-black bg-green-100 px-1 text-[11px]">{leftLabel} (6 Tasks)</th>
            <th colSpan={7} className="border border-black bg-violet-100 px-1 text-[11px]">{rightLabel} (6 Tasks)</th>
            <th rowSpan={2} className="border border-black bg-sky-100 px-1">Total Score</th>
            <th rowSpan={2} className="border border-black bg-orange-100 px-1">Teacher&apos;s Overall Comment(s)</th>
          </tr>
          <tr>
            {[leftMax, rightMax].map((list, side) => (
              <Fragment key={side}>
                {TASKS.map((n) => (
                  <th key={`${side}-${n}`} className={`border border-black px-0.5 font-normal ${side === 0 ? "bg-green-50" : "bg-violet-50"}`}>
                    Task {n}
                    <br />({TERM_OF(n)}){maxOf(list, n) != null && <><br />/{maxOf(list, n)}</>}
                  </th>
                ))}
                <th className={`border border-black px-0.5 ${side === 0 ? "bg-green-50" : "bg-violet-50"}`}>Total</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r, i) => {
            const left = hasEarlier ? r.earlier : r.current;
            const leftTotal = hasEarlier ? r.earlierTotal : r.currentTotal;
            const right = hasEarlier ? r.current : null;
            const rightTotal = hasEarlier ? r.currentTotal : null;
            return (
              <tr key={i} className="h-6">
                <td className="border border-black px-1 text-center">{i + 1}</td>
                <td className="border border-black px-1">{r.name}</td>
                <td className="border border-black px-1">{r.examinationNumber ?? ""}</td>
                {TASKS.map((n) => <td key={`l${n}`} className="border border-black text-center tabular-nums">{show(left?.[n])}</td>)}
                <td className="border border-black text-center font-semibold tabular-nums">{left ? leftTotal ?? "" : ""}</td>
                {TASKS.map((n) => <td key={`r${n}`} className="border border-black text-center tabular-nums">{show(right?.[n])}</td>)}
                <td className="border border-black text-center font-semibold tabular-nums">{right ? rightTotal ?? "" : ""}</td>
                <td className="border border-black text-center font-semibold tabular-nums">{hasEarlier ? r.grandTotal : r.currentTotal}</td>
                <td className="border border-black px-1">{r.comment ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 grid grid-cols-2 gap-x-10 gap-y-2">
        <Line label="Teacher's Name:" value={s.teacher.name} />
        <Line label="TS No:" value={s.teacher.tsNumber} />
        <Line label="Signature:" />
        <Line label="Date:" />
        <Line label="Head Teacher's Name:" value={s.headTeacher?.name} />
        <Line label="TS No:" value={s.headTeacher?.tsNumber} />
        <Line label="Signature:" />
        <div className="flex items-end gap-2">
          <span className="text-[11px] font-semibold italic">Date Stamp</span>
          <span className="h-12 flex-1 border border-black" />
        </div>
      </div>
      <div className="mt-3 flex h-1 w-full" aria-hidden>
        <span className="flex-[7] bg-[#198a00]" />
        <span className="flex-1 bg-[#de2010]" />
        <span className="flex-1 bg-black" />
        <span className="flex-1 bg-[#ef7d00]" />
      </div>
    </div>
  );
}
