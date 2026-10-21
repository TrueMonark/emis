/** Shapes returned by /api/finance/* (school fees). Amounts are whole ngwee (K1 = 100). */

export type FeeCategory =
  | "TUITION"
  | "BOARDING"
  | "TRANSPORT"
  | "MEALS"
  | "EXAMINATION"
  | "UNIFORM"
  | "BOOKS"
  | "DEVELOPMENT"
  | "TRIP"
  | "EVENT"
  | "OTHER";
export type PaymentMethod = "CASH" | "BANK_DEPOSIT" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE" | "OTHER";
export type ChargeStatus = "PAID" | "PART_PAID" | "UNPAID" | "WAIVED";

export interface FinanceOptions {
  canEdit: boolean;
  isLeader: boolean;
  school: { id: string; name: string };
  activeYear: { id: string; year: number } | null;
  years: { id: string; year: number; isActive: boolean }[];
  terms: { id: string; termType: string; academicYearId: string; isActive: boolean; startDate: string; endDate: string; label: string }[];
  grades: { id: string; name: string; sequence: number }[];
  classes: { id: string; gradeId: string; label: string }[];
  categories: { value: FeeCategory; label: string }[];
}

export interface Fee {
  id: string;
  name: string;
  category: FeeCategory;
  description: string | null;
  academicYear: number;
  academicYearId: string;
  termId: string | null;
  termLabel: string | null;
  amountNgwee: number;
  dueDate: string;
  targetKind: "ALL" | "YEAR_LEVELS" | "CLASSES" | "LEARNERS";
  targets: string[];
  optional: boolean;
  archived: boolean;
  instalments: { id: string; label: string; dueDate: string; percent: number }[];
  learners: number;
  chargedNgwee: number;
  paidNgwee: number;
  outstandingNgwee: number;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  studentId: string;
  learner: string;
  learnerNumber: string | null;
  amountNgwee: number;
  method: PaymentMethod;
  methodLabel: string;
  reference: string | null;
  payerName: string | null;
  paidOn: string;
  feeId: string | null;
  feeName: string | null;
  notes: string | null;
  source: string;
  status: "RECORDED" | "VOIDED";
  receivedBy: string | null;
  recordedAt: string;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
}

export interface LearnerRow {
  studentId: string;
  name: string;
  learnerNumber: string | null;
  classId: string;
  classLabel: string;
  chargedNgwee: number;
  paidNgwee: number;
  balanceNgwee: number;
  overdueNgwee: number;
  creditNgwee: number;
}

export interface Discount {
  id: string;
  studentId?: string;
  learner?: string;
  learnerNumber?: string | null;
  name: string;
  kind: "PERCENT" | "AMOUNT";
  value: number;
  categories: FeeCategory[];
  reason: string | null;
  year: number;
  createdAt?: string;
  endedAt: string | null;
}

export interface LearnerAccount {
  school: { id: string; name: string };
  learner: {
    id: string;
    name: string;
    learnerNumber: string | null;
    studentNumber: string | null;
    classLabel: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
  };
  totals: { chargedNgwee: number; discountNgwee: number; paidNgwee: number; balanceNgwee: number; overdueNgwee: number; creditNgwee: number };
  charges: {
    chargeId: string;
    feeId: string;
    feeName: string;
    category: FeeCategory;
    categoryLabel: string;
    period: string;
    dueDate: string | null;
    originalNgwee: number;
    discountNgwee: number;
    amountNgwee: number;
    paidNgwee: number;
    balanceNgwee: number;
    dueNowNgwee: number;
    overdueNgwee: number;
    status: ChargeStatus;
  }[];
  payments: Payment[];
  discounts: Discount[];
}

export interface Receipt extends Payment {
  school: { id: string; name: string };
  classLabel: string | null;
  balanceAfterNgwee: number;
}
