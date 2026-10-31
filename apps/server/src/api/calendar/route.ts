import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { calendarService } from "@/features/calendar/calendar.service";

/** GET /api/calendar?year=2026 — the school's calendar: public holidays and closures. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const raw = Number(new URL(request.url).searchParams.get("year"));
    const year = Number.isInteger(raw) && raw >= 2000 && raw <= 2100 ? raw : new Date().getUTCFullYear();
    return ApiResponse.success(await calendarService.schoolYear({ userId: user.userId, role: user.role }, year));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/calendar" });
  }
});
