import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { registerCoverService } from "@/features/attendance/registerCover.service";

/**
 * DELETE /api/attendance/register-covers/[id]
 * Cancel a register cover (the class teacher is back, or it was set up by mistake).
 * Attendance already taken by the covering teacher is kept.
 */
export const DELETE = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    await registerCoverService.cancel(id, { userId: user.userId, role: user.role });
    return ApiResponse.success({ id, cancelled: true });
  } catch (error) {
    return handleApiError(error, {
      userId: user.userId,
      endpoint: `DELETE /api/attendance/register-covers/${id}`,
    });
  }
});
