import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { announcementService } from "@/features/announcements/announcement.service";

/** GET /api/announcements — the announcements that reach this person at their school. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await announcementService.inbox({ userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/announcements" });
  }
});
