import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { calendarService } from "@/features/calendar/calendar.service";
import { createClosureSchema } from "@/features/calendar/calendar.validation";

/** POST /api/calendar/closures — the head or deputy closes the school for some days (no registers). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = createClosureSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.created(await calendarService.addClosure({ userId: user.userId, role: user.role }, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/calendar/closures" });
  }
});
