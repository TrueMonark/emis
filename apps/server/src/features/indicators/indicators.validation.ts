import { z } from "zod";
import { POWER_SOURCES, WATER_SOURCES } from "@school/shared/returns/indicators";

const count = (what: string) =>
  z
    .number({ message: `Enter the number of ${what}` })
    .int(`Enter a whole number of ${what}`)
    .min(0, `The number of ${what} can't be negative`)
    .max(100_000, `Check the number of ${what}`)
    .nullable()
    .optional();

/** A school's facilities (the School profile page, and the copy inside a return). */
export const facilitiesSchema = z.object({
  classrooms: count("classrooms"),
  desks: count("desks"),
  toiletsBoys: count("toilets for boys"),
  toiletsGirls: count("toilets for girls"),
  toiletsStaff: count("toilets for staff"),
  waterSource: z.enum(WATER_SOURCES).nullable().optional(),
  power: z.enum(POWER_SOURCES).nullable().optional(),
  internet: z.boolean().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type FacilitiesInput = z.infer<typeof facilitiesSchema>;
