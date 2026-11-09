import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { sbaService } from "@/features/sba/sba.service";
import { reviewSheetSchema } from "@/features/sba/sba.validation";

/** POST /api/sba/[id]/review — the HOD approves the sheet or sends it back with a comment. */
export const POST = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = reviewSheetSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.success(await sbaService.review({ userId: user.userId, role: user.role }, id, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/sba/[id]/review`.replace("[id]", id) });
  }
});
