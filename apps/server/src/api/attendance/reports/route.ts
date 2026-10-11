import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { attendanceRecordService } from "@/features/attendance/attendanceRecord.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * GET /api/attendance/reports
 * Get attendance summary report for a class over a date range
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const context: AuthContext = { userId: user.userId, role: user.role as Role };

    const searchParams = new URL(request.url).searchParams;
    const classId = searchParams.get("classId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!classId || !startDate || !endDate) {
      return ApiResponse.badRequest("classId, startDate, and endDate are required");
    }

    const summary = await attendanceRecordService.getClassAttendanceSummary(
      classId,
      new Date(startDate),
      new Date(endDate),
      context
    );

    return ApiResponse.success(summary);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/attendance/reports" });
  }
});
