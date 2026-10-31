import { total, type DerivedIndicators, type ReturnFigures } from "@school/shared/returns/indicators";
import { downloadCsv } from "@/components/finance/csv";

/** Columns for a spreadsheet of schools / districts / provinces with their figures. */
export const FIGURES_CSV_HEADER = [
  "Learners (boys)",
  "Learners (girls)",
  "Learners",
  "Admitted",
  "Left",
  "Repeating",
  "Orphans",
  "Other vulnerable",
  "Special needs",
  "Teachers",
  "Teachers (men)",
  "Teachers (women)",
  "Teachers with diploma or degree",
  "Classes",
  "Learners per teacher",
  "Average class size",
  "Attendance %",
  "Registers taken %",
  "Learners per classroom",
  "Learners per desk",
];

export function figuresCsvCells(f: ReturnFigures, d: DerivedIndicators) {
  return [
    f.learners.male,
    f.learners.female,
    total(f.learners),
    total(f.newLearners),
    total(f.leavers),
    total(f.repeaters),
    total(f.orphans),
    total(f.vulnerable),
    total(f.specialNeeds),
    f.teachers.total,
    f.teachers.male,
    f.teachers.female,
    f.teachers.degree + f.teachers.diploma,
    f.classes,
    d.pupilTeacherRatio,
    d.averageClassSize,
    d.attendancePercent,
    d.registersPercent,
    d.learnersPerClassroom,
    d.learnersPerDesk,
  ];
}

export { downloadCsv };
