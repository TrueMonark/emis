import { z } from "zod";

const day = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);

export const createClosureSchema = z
  .object({
    name: z.string().trim().min(2, "Name the closure (e.g. Mid-term break)").max(100),
    startDate: day("Start date YYYY-MM-DD"),
    endDate: day("End date YYYY-MM-DD"),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "The last day can't be before the first day" });

export const createHolidayChangeSchema = z.object({
  date: day("Date YYYY-MM-DD"),
  kind: z.enum(["ADD", "CANCEL"]),
  name: z.string().trim().min(2, "Name the holiday").max(120),
  reason: z.string().trim().max(300).optional().nullable(),
});

export type CreateClosureInput = z.infer<typeof createClosureSchema>;
export type CreateHolidayChangeInput = z.infer<typeof createHolidayChangeSchema>;
