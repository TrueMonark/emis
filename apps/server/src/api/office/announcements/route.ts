import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf } from "@/features/offices/office.service";
import { announcementService } from "@/features/announcements/announcement.service";
import { postAnnouncementSchema, type IncomingFile } from "@/features/announcements/announcement.validation";

/** GET /api/office/announcements — announcements from this office and the offices above, with progress. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await announcementService.officeList(officeContextOf(user)));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/announcements" });
  }
});

/**
 * POST /api/office/announcements — the head of the office posts one (multipart form: title, body,
 * audience, requiresAck, and up to 5 files named "files").
 */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const form = await request.formData().catch(() => {
      throw new ValidationError("Send the announcement as a form");
    });
    const parsed = postAnnouncementSchema.safeParse({
      title: form.get("title") ?? "",
      body: form.get("body") ?? "",
      audience: form.get("audience") ?? "",
      requiresAck: form.get("requiresAck") === "true",
    });
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the announcement"));
    const files: IncomingFile[] = [];
    for (const entry of form.getAll("files")) {
      if (typeof entry === "string") continue;
      files.push({ name: entry.name, bytes: Buffer.from(await entry.arrayBuffer()) });
    }
    return ApiResponse.created(await announcementService.post(officeContextOf(user), parsed.data, files));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/office/announcements" });
  }
});
