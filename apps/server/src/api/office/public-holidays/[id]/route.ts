import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { calendarService } from "@/features/calendar/calendar.service";

/** DELETE /api/office/public-holidays/[id] — undo one of HQ's holiday changes. */
export const DELETE = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await calendarService.removeHolidayChange(officeContextOf(user), id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `DELETE /api/office/public-holidays/${id}` });
  }
});
