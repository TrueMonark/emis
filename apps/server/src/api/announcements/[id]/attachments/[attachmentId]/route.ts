import { withAuth } from "@/lib/http/with-auth";
import { handleApiError } from "@/lib/http/error-handler";
import { fileResponse } from "@/lib/http/file-response";
import { announcementService } from "@/features/announcements/announcement.service";

/** GET /api/announcements/[id]/attachments/[attachmentId] — an attachment, only for people it was sent to. */
export const GET = withAuth(async (_request: Request, user, { params }) => {
  const { id, attachmentId } = await params;
  try {
    const f = await announcementService.schoolAttachment({ userId: user.userId, role: user.role }, id, attachmentId);
    return fileResponse(f.bytes, f.fileName, f.mimeType);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/announcements/${id}/attachments/${attachmentId}` });
  }
});
