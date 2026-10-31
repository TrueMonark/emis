import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf } from "@/features/offices/office.service";
import { returnsService } from "@/features/returns/returns.service";
import { reviewSchema } from "@/features/returns/returns.validation";

/** POST /api/office/school-returns/[id]/review — the DEBS approves a return or sends it back. */
export const POST = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = reviewSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the decision"));
    return ApiResponse.success(await returnsService.review(officeContextOf(user), id, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/office/school-returns/${id}/review` });
  }
});
