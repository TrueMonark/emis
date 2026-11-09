import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { announcementService } from "@/features/announcements/announcement.service";

/** POST /api/announcements/[id]/read — record that this person opened it. */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await announcementService.markRead({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/announcements/${id}/read` });
  }
});
