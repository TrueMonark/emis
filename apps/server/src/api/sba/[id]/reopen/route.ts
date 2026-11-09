import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { sbaService } from "@/features/sba/sba.service";
import { reopenSheetSchema } from "@/features/sba/sba.validation";

/** POST /api/sba/[id]/reopen — the head teacher or deputy reopens an approved or confirmed sheet. */
export const POST = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = reopenSheetSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.success(await sbaService.reopen({ userId: user.userId, role: user.role }, id, parsed.data.comment));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/sba/[id]/reopen`.replace("[id]", id) });
  }
});
