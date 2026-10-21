import { z } from "zod";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (msg: string) => z.string().regex(DAY, msg);
/** Money arrives as whole ngwee (K1 = 100). */
const ngwee = (label: string) => z.number().int(`${label} must be in ngwee (whole numbers)`).positive(`${label} must be more than K0.00`).max(100_000_000_00, `${label} is too large`);

export const CATEGORIES = ["TUITION", "BOARDING", "TRANSPORT", "MEALS", "EXAMINATION", "UNIFORM", "BOOKS", "DEVELOPMENT", "TRIP", "EVENT", "OTHER"] as const;
export const METHODS = ["CASH", "BANK_DEPOSIT", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE", "OTHER"] as const;

const instalments = z
  .array(z.object({ label: z.string().trim().min(1).max(60), dueDate: day("Instalment date YYYY-MM-DD"), percent: z.number().int().min(1).max(100) }))
  .max(12)
  .optional()
  .default([])
  .refine((list) => list.length === 0 || list.reduce((s, i) => s + i.percent, 0) === 100, {
    message: "The instalments must add up to 100%",
  });

export const createFeeSchema = z
  .object({
    name: z.string().trim().min(2, "Name the fee").max(120),
    category: z.enum(CATEGORIES),
    description: z.string().trim().max(500).optional().nullable(),
    /** A term of the current year, or none for a one-off / whole-year charge */
    termId: z.string().min(1).optional().nullable(),
    amountNgwee: ngwee("The amount"),
    dueDate: day("Due date YYYY-MM-DD"),
    targetKind: z.enum(["ALL", "YEAR_LEVELS", "CLASSES", "LEARNERS"]),
    gradeIds: z.array(z.string().min(1)).optional().default([]),
    classIds: z.array(z.string().min(1)).optional().default([]),
    /** For LEARNERS (or optional fees): who to charge straight away */
    studentIds: z.array(z.string().min(1)).optional().default([]),
    optional: z.boolean().optional().default(false),
    instalments,
  })
  .refine((v) => v.targetKind !== "YEAR_LEVELS" || v.gradeIds.length > 0, { path: ["gradeIds"], message: "Choose the year levels" })
  .refine((v) => v.targetKind !== "CLASSES" || v.classIds.length > 0, { path: ["classIds"], message: "Choose the classes" });

export const termFeesSchema = z.object({
  termId: z.string().min(1, "Choose the term"),
  name: z.string().trim().min(2).max(80),
  category: z.enum(CATEGORIES),
  dueDate: day("Due date YYYY-MM-DD"),
  instalments,
  amounts: z
    .array(z.object({ gradeId: z.string().min(1), amountNgwee: z.number().int().min(0).max(100_000_000_00) }))
    .min(1, "Give at least one year level an amount"),
});

export const updateFeeSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  dueDate: day("Due date YYYY-MM-DD").optional(),
  amountNgwee: ngwee("The amount").optional(),
  archived: z.boolean().optional(),
  instalments: instalments.optional(),
});

export const feeLearnersSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "Choose at least one learner").max(500),
});

export const createDiscountSchema = z
  .object({
    studentId: z.string().min(1),
    name: z.string().trim().min(2, "Name the discount (e.g. Sibling discount)").max(80),
    kind: z.enum(["PERCENT", "AMOUNT"]),
    /** percent (1–100) or ngwee */
    value: z.number().int().positive(),
    categories: z.array(z.enum(CATEGORIES)).optional().default([]),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .refine((v) => v.kind !== "PERCENT" || v.value <= 100, { path: ["value"], message: "A percentage can't be more than 100" });

export const recordPaymentSchema = z.object({
  studentId: z.string().min(1, "Choose the learner"),
  amountNgwee: ngwee("The amount"),
  method: z.enum(METHODS),
  reference: z.string().trim().max(80).optional().nullable(),
  payerName: z.string().trim().max(120).optional().nullable(),
  paidOn: day("Date YYYY-MM-DD"),
  feeId: z.string().min(1).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(3, "Say why it's being cancelled").max(300),
});

export const createFinanceStaffSchema = z.object({
  displayName: z.string().trim().min(2, "Full name").max(120),
  email: z.string().trim().toLowerCase().email("A valid email"),
  phone: z.string().trim().max(20).optional().nullable(),
});

export type CreateFeeInput = z.infer<typeof createFeeSchema>;
export type TermFeesInput = z.infer<typeof termFeesSchema>;
export type UpdateFeeInput = z.infer<typeof updateFeeSchema>;
export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type CreateFinanceStaffInput = z.infer<typeof createFinanceStaffSchema>;
