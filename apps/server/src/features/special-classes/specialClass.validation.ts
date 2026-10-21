import { z } from "zod";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const createSpecialClassSchema = z
  .object({
    classId: z.string().min(1, "Choose the class"),
    subjectId: z.string().min(1, "Choose the subject"),
    date: z.string().regex(DAY, "Choose the day (YYYY-MM-DD)"),
    startTime: z.string().regex(TIME, "Start time like 08:00"),
    endTime: z.string().regex(TIME, "End time like 10:00"),
    topic: z.string().trim().min(2, "What will you teach?").max(200),
    venue: z.string().trim().max(100).optional().nullable(),
    reason: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.startTime < v.endTime, { path: ["endTime"], message: "The class must end after it starts" });

export const decideSpecialClassSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});

export const specialClassRegisterSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
        remarks: z.string().trim().max(300).optional().nullable(),
      })
    )
    .min(1, "Mark at least one learner")
    .max(200),
});

export type CreateSpecialClassInput = z.infer<typeof createSpecialClassSchema>;
export type SpecialClassRegisterInput = z.infer<typeof specialClassRegisterSchema>;
