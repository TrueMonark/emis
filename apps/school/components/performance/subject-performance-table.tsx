"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@school/ui/components/table";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssessmentScore {
  type: "CAT" | "MID" | "EOT";
  score: number;
  rank: number;
  total: number;
  trend: "up" | "down" | "same";
  isAbsent?: boolean;
}

export interface SubjectPerformanceRow {
  studentId: string;
  studentName: string;
  assessments: AssessmentScore[];
}

const COLUMNS: { type: AssessmentScore["type"]; label: string }[] = [
  { type: "CAT", label: "CAT" },
  { type: "MID", label: "Mid-term" },
  { type: "EOT", label: "End of term" },
];

function scoreClass(score: number) {
  if (score >= 75) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-foreground";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function Trend({ trend }: { trend: AssessmentScore["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-green-600" aria-label="up" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-600" aria-label="down" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-label="no change" />;
}

/**
 * List view of a subject teacher's class: one row per learner with their CAT, mid-term and
 * end-of-term scores (and position in class), easier to scan than the card grid for a full class.
 */
export function SubjectPerformanceTable({
  students,
  startIndex = 0,
}: {
  students: SubjectPerformanceRow[];
  /** Row number of the first student shown (for paging). */
  startIndex?: number;
}) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Student</TableHead>
            {COLUMNS.map((c) => (
              <TableHead key={c.type} className="text-center">
                {c.label}
              </TableHead>
            ))}
            <TableHead className="text-center">Average</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student, i) => {
            const sat = student.assessments.filter((a) => !a.isAbsent);
            const average = sat.length
              ? Math.round(sat.reduce((sum, a) => sum + a.score, 0) / sat.length)
              : null;
            return (
              <TableRow key={student.studentId}>
                <TableCell className="text-muted-foreground tabular-nums">{startIndex + i + 1}</TableCell>
                <TableCell className="font-medium">{student.studentName}</TableCell>
                {COLUMNS.map((c) => {
                  const a = student.assessments.find((x) => x.type === c.type);
                  return (
                    <TableCell key={c.type} className="text-center">
                      {!a ? (
                        <span className="text-muted-foreground">–</span>
                      ) : a.isAbsent ? (
                        <span className="text-xs font-medium text-muted-foreground">Absent</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={cn("font-semibold tabular-nums", scoreClass(a.score))}>
                            {Math.round(a.score)}%
                          </span>
                          <Trend trend={a.trend} />
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {a.rank}/{a.total}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">
                  {average === null ? (
                    <span className="text-muted-foreground">–</span>
                  ) : (
                    <span className={cn("font-semibold tabular-nums", scoreClass(average))}>{average}%</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
