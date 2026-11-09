import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf } from "@/features/offices/office.service";
import { announcementService } from "@/features/announcements/announcement.service";
import { withdrawAnnouncementSchema } from "@/features/announcements/announcement.validation";

/** POST /api/office/announcements/[id]/withdraw — the posting office withdraws it, with a reason. */
export const POST = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = withdrawAnnouncementSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Say why"));
    return ApiResponse.success(await announcementService.withdraw(officeContextOf(user), id, parsed.data.reason));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/office/announcements/${id}/withdraw` });
  }
});
