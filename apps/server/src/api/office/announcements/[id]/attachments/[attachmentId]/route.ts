import { withAuth } from "@/lib/http/with-auth";
import { handleApiError } from "@/lib/http/error-handler";
import { fileResponse } from "@/lib/http/file-response";
import { officeContextOf } from "@/features/offices/office.service";
import { announcementService } from "@/features/announcements/announcement.service";

/** GET /api/office/announcements/[id]/attachments/[attachmentId] — an attachment, for the offices that see it. */
export const GET = withAuth(async (_request: Request, user, { params }) => {
  const { id, attachmentId } = await params;
  try {
    const f = await announcementService.officeAttachment(officeContextOf(user), id, attachmentId);
    return fileResponse(f.bytes, f.fileName, f.mimeType);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/office/announcements/${id}/attachments/${attachmentId}` });
  }
});
