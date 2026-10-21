import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const name = (label: string) => z.string().trim().min(2, `${label} is required`).max(120);

export const createOfficeSchema = z.object({
  name: name("Office name"),
  code: z.string().trim().max(30).optional().nullable(),
  /** Province the district belongs to (HQ only; a PEO always adds to its own province) */
  parentId: z.string().min(1).optional().nullable(),
});

export const updateOfficeSchema = z.object({
  name: name("Office name").optional(),
  code: z.string().trim().max(30).optional().nullable(),
  isActive: z.boolean().optional(),
});

const PHONE = /^(\+260|0)\d{9}$/;

export const createOfficeAccountSchema = z.object({
  officeId: z.string().min(1, "Choose the office"),
  email,
  /** Optional: lets them sign in with their mobile number too */
  phone: z
    .string()
    .trim()
    .regex(PHONE, "Use a Zambian number like 0977123456 or +260977123456")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  displayName: name("Name"),
  role: z.enum(["OFFICE_HEAD", "OFFICER"]),
  title: z.string().trim().max(80).optional().nullable(),
});

export const createSchoolSchema = z.object({
  name: name("School name"),
  emisNumber: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers and dashes only")
    .optional()
    .nullable(),
  category: z.enum(["PUBLIC", "AIDED", "COMMUNITY", "PRIVATE"]),
  agency: z.string().trim().max(120).optional().nullable(),
  /** The first head teacher: a new person (gets an account), or an existing one (by user id). */
  head: z.preprocess(
    // Which kind of head is decided by the body: { existingUserId } or a new person's details.
    (v) =>
      v && typeof v === "object"
        ? { ...(v as object), kind: "existingUserId" in (v as object) ? "existing" : "new" }
        : v,
    z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing"), existingUserId: z.string().min(1, "Find the person first") }),
    z.object({
    kind: z.literal("new"),
    email,
    firstName: name("First name"),
    lastName: name("Last name"),
    phone: z.string().trim().regex(PHONE, "Use a Zambian number like 0977123456 or +260977123456"),
    gender: z.enum(["MALE", "FEMALE"]),
    dateOfBirth: z.coerce.date(),
    staffNumber: z
      .string()
      .trim()
      .min(1, "Staff number is required")
      .max(50)
      .regex(/^[A-Z0-9-]+$/, "Capital letters, numbers and dashes only"),
    qualification: z.enum(["CERTIFICATE", "DIPLOMA", "DEGREE", "MASTERS", "DOCTORATE"]),
    }),
    ])
  ),
});

export const updateSchoolSchema = z.object({
  name: name("School name").optional(),
  emisNumber: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers and dashes only")
    .optional()
    .nullable(),
  emisStatus: z.enum(["CONFIRMED", "PENDING", "DISPUTED"]).optional(),
  category: z.enum(["PUBLIC", "AIDED", "COMMUNITY", "PRIVATE"]).optional(),
  agency: z.string().trim().max(120).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  /** School fees pages (always on for private schools) */
  feesEnabled: z.boolean().optional(),
});

export const moveSchoolSchema = z.object({
  districtOfficeId: z.string().min(1, "Choose the district"),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
export type CreateOfficeAccountInput = z.infer<typeof createOfficeAccountSchema>;
