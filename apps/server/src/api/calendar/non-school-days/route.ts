import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { calendarService } from "@/features/calendar/calendar.service";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/calendar/non-school-days?from=YYYY-MM-DD&to=YYYY-MM-DD — public holidays and closure
 * days in the range (weekends not listed). Used by the register pages.
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    const from = q.get("from");
    const to = q.get("to") ?? from;
    if (!from || !to || !DAY.test(from) || !DAY.test(to) || to < from) throw new ValidationError("Give the dates as from=YYYY-MM-DD&to=YYYY-MM-DD");
    return ApiResponse.success(await calendarService.nonSchoolDays(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`)));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/calendar/non-school-days" });
  }
});
