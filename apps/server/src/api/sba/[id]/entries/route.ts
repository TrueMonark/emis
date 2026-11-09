import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { sbaService } from "@/features/sba/sba.service";
import { saveEntriesSchema } from "@/features/sba/sba.validation";

/** PUT /api/sba/[id]/entries — save marks, examination numbers and comments (all or none). */
export const PUT = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = saveEntriesSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.success(await sbaService.saveEntries({ userId: user.userId, role: user.role }, id, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PUT /api/sba/[id]/entries`.replace("[id]", id) });
  }
});
