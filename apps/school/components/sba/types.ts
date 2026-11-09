import type { SbaStatusValue } from "@school/shared/sba/sba";

/** Shapes the SBA API returns (features/sba on the server). */

export interface SbaFlags {
  mine: boolean;
  canView: boolean;
  canEdit: boolean;
  canReview: boolean;
  canConfirm: boolean;
  canReopen: boolean;
}

export interface SbaSummary extends SbaFlags {
  id: string;
  year: number;
  class: { id: string; label: string };
  subject: { id: string; name: string; department: string | null };
  teacher: { id: string; name: string };
  status: Exclude<SbaStatusValue, "NOT_STARTED">;
  submittedAt: string | null;
  confirmedAt: string | null;
  updatedAt: string;
}

export interface SbaOverview {
  year: { id: string; year: number } | null;
  isLeader: boolean;
  isHod: boolean;
  mine: { classId: string; subjectId: string; classLabel: string; subjectName: string; sheet: SbaSummary | null }[];
  others: SbaSummary[];
  notStarted: { teacher: string; classLabel: string; subjectName: string }[];
}

export interface SbaMark {
  marks: number | null;
  isAbsent: boolean;
}

export interface SbaTaskRow {
  id: string;
  number: number;
  term: number;
  title: string;
  description: string | null;
  maxMarks: number;
  dueDate: string | null;
}

export interface SbaLearnerRow {
  studentId: string;
  name: string;
  learnerNumber: string;
  gender: string;
  left: boolean;
  examinationNumber: string | null;
  comment: string | null;
  marks: Record<string, SbaMark>;
  total: { score: number; outOf: number; percent: number | null; complete: boolean };
}

export interface SbaSheetDetail extends SbaSummary {
  reviewComment: string | null;
  hodDecidedAt: string | null;
  hodDecidedBy: string | null;
  confirmedBy: string | null;
  tasks: SbaTaskRow[];
  learners: SbaLearnerRow[];
  incomplete: number;
  events: { id: string; action: string; label: string; by: string | null; comment: string | null; at: string }[];
}

export interface SbaScoreSheet {
  school: { name: string; centreCode: string | null; district: string; province: string };
  subject: { name: string; code: string };
  year: number;
  status: string;
  levels: { earlier: string | null; current: string };
  classLabel: string;
  earlierTasks: { number: number; maxMarks: number }[] | null;
  currentTasks: { number: number; maxMarks: number; title: string }[];
  rows: {
    name: string;
    examinationNumber: string | null;
    earlier: Record<string, SbaMark | null> | null;
    earlierTotal: number | null;
    earlierConfirmed: boolean | null;
    current: Record<string, SbaMark>;
    currentTotal: number;
    grandTotal: number;
    comment: string | null;
  }[];
  teacher: { name: string; tsNumber: string | null };
  headTeacher: { name: string; tsNumber: string | null } | null;
  confirmedAt: string | null;
}
