import { parseSignInId } from "@school/shared/auth/sign-in-id";
import { z } from "zod";

/**
 * Login request: an email address or a Zambian mobile number, plus the password. The screens
 * send `identifier`; `email` is still accepted from older clients.
 */
export const loginSchema = z
  .object({
    identifier: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .transform((v, ctx) => {
    const typed = (v.identifier ?? v.email ?? "").trim();
    const id = parseSignInId(typed);
    if (!id) {
      ctx.addIssue({
        code: "custom",
        path: ["identifier"],
        message: typed
          ? "Enter a valid email address or mobile number (e.g. 0977 123 456)"
          : "Email or mobile number is required",
      });
      return z.NEVER;
    }
    return { identifier: id.value, password: v.password };
  });

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Password validation schema (for registration/password change)
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");
