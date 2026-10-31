import { z } from "zod";
import { facilitiesSchema } from "@/features/indicators/indicators.validation";

const day = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);

/** An office opens a return round for its schools. */
export const openRoundSchema = z
  .object({
    title: z.string().trim().min(3, "Give the return a name (e.g. 2026 Annual School Census)").max(120),
    instructions: z.string().trim().max(2000).optional().nullable(),
    periodStart: day("Period start YYYY-MM-DD"),
    periodEnd: day("Period end YYYY-MM-DD"),
    dueDate: day("Due date YYYY-MM-DD"),
  })
  .refine((v) => v.periodEnd >= v.periodStart, { path: ["periodEnd"], message: "The period can't end before it starts" })
  .refine((v) => v.dueDate >= v.periodStart, { path: ["dueDate"], message: "The due date can't be before the period starts" });

export const roundStatusSchema = z.object({ status: z.enum(["OPEN", "CLOSED"]) });

/** The school saves its draft: facilities as reported and the head's remarks. */
export const saveDraftSchema = z.object({
  facilities: facilitiesSchema.omit({ notes: true }),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

/** The DEBS decides on a submitted return. */
export const reviewSchema = z
  .object({
    decision: z.enum(["APPROVE", "RETURN"]),
    comment: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((v) => v.decision === "APPROVE" || (v.comment && v.comment.length >= 3), {
    path: ["comment"],
    message: "Say what the school needs to correct",
  });

export const reopenSchema = z.object({
  comment: z.string().trim().min(3, "Say why the return is being reopened").max(2000),
});

export type OpenRoundInput = z.infer<typeof openRoundSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
