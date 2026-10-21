export const runtime = "nodejs";

import { z } from "zod";
import { parseSignInId } from "@school/shared/auth/sign-in-id";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { checkRateLimit, getClientIp } from "@/lib/http/rate-limit";
import { passwordResetService, RESET_REQUEST_REPLY } from "@/features/password-resets/passwordReset.service";

const bodySchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email address or mobile number").max(200),
});

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/**
 * POST /api/auth/forgot-password — "Forgot password?" on the sign-in page. Like the login route,
 * it can't require a sign-in. It never says whether the account exists: the reply is always the
 * same, and the request goes to the person's head teacher/deputy (or office), who resets it.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const ipLimit = checkRateLimit(`forgot:ip:${ip}`, 10, FIFTEEN_MINUTES);
    if (!ipLimit.allowed) {
      return Response.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? "Enter your email address or mobile number");
    }

    // Asking again for the same account within the hour changes nothing (and isn't told apart).
    const typed = parseSignInId(parsed.data.identifier)?.value ?? parsed.data.identifier.toLowerCase();
    const idLimit = checkRateLimit(`forgot:id:${typed}`, 3, ONE_HOUR);
    if (idLimit.allowed) {
      await passwordResetService.request(parsed.data.identifier);
    }

    return ApiResponse.success({ message: RESET_REQUEST_REPLY });
  } catch (error) {
    return handleApiError(error, { endpoint: "POST /api/auth/forgot-password" });
  }
}
