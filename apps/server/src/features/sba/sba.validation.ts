import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates are YYYY-MM-DD");

export const startSheetSchema = z.object({
  classId: z.string().min(1, "Choose the class"),
  subjectId: z.string().min(1, "Choose the subject"),
});

export const updateTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1, "Name every task").max(150),
        description: z.string().trim().max(1000).nullable().optional(),
        maxMarks: z.number().positive("A task must be out of more than 0").max(1000, "Check the maximum mark"),
        dueDate: day.nullable().optional(),
      })
    )
    .min(1)
    .max(6),
});

export const saveEntriesSchema = z.object({
  marks: z
    .array(
      z.object({
        taskId: z.string().min(1),
        studentId: z.string().min(1),
        marks: z.number().min(0, "Marks can't be negative").nullable(),
        isAbsent: z.boolean().default(false),
      })
    )
    .max(6 * 200)
    .default([]),
  notes: z
    .array(
      z.object({
        studentId: z.string().min(1),
        examinationNumber: z.string().trim().max(40).nullable().optional(),
        comment: z.string().trim().max(500).nullable().optional(),
      })
    )
    .max(200)
    .default([]),
});

export const reviewSheetSchema = z
  .object({
    decision: z.enum(["APPROVE", "RETURN"]),
    comment: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.decision === "APPROVE" || (v.comment && v.comment.length >= 3), {
    path: ["comment"],
    message: "Say what the teacher needs to correct",
  });

export const reopenSheetSchema = z.object({
  comment: z.string().trim().min(3, "Say why the sheet is being reopened").max(2000),
});

export const centreCodeSchema = z.object({
  eczCentreCode: z.string().trim().max(20, "Check the centre code").nullable(),
});

export type UpdateTasksInput = z.infer<typeof updateTasksSchema>;
export type SaveEntriesInput = z.infer<typeof saveEntriesSchema>;
export type ReviewSheetInput = z.infer<typeof reviewSheetSchema>;
