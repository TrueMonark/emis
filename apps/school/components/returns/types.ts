import type {
  DerivedIndicators,
  FacilitiesData,
  FacilitiesSummary,
  ReturnFigures,
  ReturnStatusValue,
} from "@school/shared/returns/indicators";

/** Shapes the Phase 7 API returns (see features/indicators and features/returns on the server). */

export interface Summary {
  figures: ReturnFigures;
  facilities: FacilitiesSummary;
  derived: DerivedIndicators;
}

export interface DashboardRow {
  id: string;
  name: string;
  kind: "PROVINCE" | "DISTRICT" | "SCHOOL";
  schools: number;
  emisNumber?: string | null;
  inSetup?: boolean;
  summary: Summary;
}

export interface Dashboard {
  period: { from: string; to: string };
  scope: { id: string; name: string; type: "HQ" | "PROVINCIAL" | "DISTRICT"; parent: { id: string; name: string } | null };
  total: Summary & { schools: number };
  rows: DashboardRow[];
}

export interface SchoolProfile {
  period: { from: string; to: string };
  school: { id: string; name: string; emisNumber: string | null; category: string; agency: string | null; eczCentreCode?: string | null; district: string; inSetup: boolean };
  leaders?: { role: string; name: string; phone: string | null }[];
  figures: ReturnFigures;
  facilities: FacilitiesData;
  facilitiesNotes: string | null;
  facilitiesUpdatedAt: string | null;
  derived: DerivedIndicators;
  district: Summary & { name: string; schools: number };
  canEdit?: boolean;
}

export interface Round {
  id: string;
  title: string;
  instructions: string | null;
  office: { id: string; name: string; type: "HQ" | "PROVINCIAL" | "DISTRICT" };
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: "OPEN" | "CLOSED";
  overdue: boolean;
  closedAt: string | null;
  createdAt: string;
}

export type StatusCounts = Record<ReturnStatusValue, number>;

export interface ReturnEvent {
  id: string;
  action: string;
  label: string;
  by: string | null;
  comment: string | null;
  at: string;
}

export interface SchoolReturnView {
  id: string;
  status: Exclude<ReturnStatusValue, "NOT_STARTED">;
  round: Round;
  school: { id: string; name: string; emisNumber: string | null; district: string };
  figures: ReturnFigures;
  facilities: FacilitiesData;
  missingFacilities: string[];
  derived: DerivedIndicators;
  figuresAt: string;
  remarks: string | null;
  submissionCount: number;
  submittedAt: string | null;
  submittedBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewComment: string | null;
  events: ReturnEvent[];
}
