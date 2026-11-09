import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { announcementService } from "@/features/announcements/announcement.service";

/** POST /api/announcements/[id]/acknowledge — the head or deputy acknowledges it for the school. */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await announcementService.acknowledge({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/announcements/${id}/acknowledge` });
  }
});
