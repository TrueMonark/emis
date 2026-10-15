import { z } from "zod";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-15");

export const createRegisterCoverSchema = z.object({
  classId: z.string().min(1),
  teacherId: z.string().min(1, "Choose the teacher who will take the register"),
  startDate: day,
  endDate: day,
  reason: z.string().max(200).optional().nullable(),
});

export const classIdQuerySchema = z.object({
  classId: z.string().min(1, "classId is required"),
});
