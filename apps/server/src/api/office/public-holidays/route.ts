import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf } from "@/features/offices/office.service";
import { calendarService } from "@/features/calendar/calendar.service";
import { createHolidayChangeSchema } from "@/features/calendar/calendar.validation";

/** GET /api/office/public-holidays?year=2026 — the national holidays: built-in, HQ's changes, result. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const raw = Number(new URL(request.url).searchParams.get("year"));
    const year = Number.isInteger(raw) && raw >= 2000 && raw <= 2100 ? raw : new Date().getUTCFullYear();
    return ApiResponse.success(await calendarService.nationalYear(officeContextOf(user), year));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/public-holidays" });
  }
});

/** POST /api/office/public-holidays — HQ declares an extra holiday or cancels a built-in one. */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = createHolidayChangeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.created(await calendarService.addHolidayChange(officeContextOf(user), parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/office/public-holidays" });
  }
});
