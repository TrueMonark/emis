import { withAuth } from "@/lib/http/with-auth";
import { handleApiError } from "@/lib/http/error-handler";
import { timetableService } from "@/features/timetables/timetable.service";
import { DayOfWeek, Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * GET /api/admin/timetable/view
 * Get complete timetable (admin view)
 *
 * Note: intentionally returns the service result at the top level (not the
 * standard ApiResponse envelope) — admin/timetable/view/page.tsx reads
 * `data.slots` directly and non-defensively.
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const context: AuthContext = { userId: user.userId, role: user.role as Role };

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");
    const roomId = searchParams.get("roomId");
    const dayOfWeek = searchParams.get("dayOfWeek");

    const filters: { classId?: string; teacherId?: string; roomId?: string; dayOfWeek?: DayOfWeek } = {};
    if (classId) filters.classId = classId;
    if (teacherId) filters.teacherId = teacherId;
    if (roomId) filters.roomId = roomId;
    if (dayOfWeek) filters.dayOfWeek = dayOfWeek as DayOfWeek;

    const result = await timetableService.getAllTimetables(context, filters);

    return Response.json(result);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/admin/timetable/view" });
  }
});
