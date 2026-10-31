import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf } from "@/features/offices/office.service";
import { returnsService } from "@/features/returns/returns.service";
import { reopenSchema } from "@/features/returns/returns.validation";

/** POST /api/office/school-returns/[id]/reopen — the DEBS reopens an approved return for correction. */
export const POST = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = reopenSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Say why"));
    return ApiResponse.success(await returnsService.reopen(officeContextOf(user), id, parsed.data.comment));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/office/school-returns/${id}/reopen` });
  }
});
