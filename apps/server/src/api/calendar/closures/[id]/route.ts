import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { calendarService } from "@/features/calendar/calendar.service";

/** DELETE /api/calendar/closures/[id] — remove a closure (registers can be taken those days again). */
export const DELETE = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await calendarService.removeClosure({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `DELETE /api/calendar/closures/${id}` });
  }
});
