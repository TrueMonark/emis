import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { announcementService } from "@/features/announcements/announcement.service";

/** GET /api/office/announcements/[id] — one announcement and each school's progress. */
export const GET = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await announcementService.officeDetail(officeContextOf(user), id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/office/announcements/${id}` });
  }
});
