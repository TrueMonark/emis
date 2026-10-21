import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { feeService } from "@/features/fees/fee.service";
import { feeLearnersSchema } from "@/features/fees/fees.validation";

/** GET /api/finance/fees/[id]/learners — learners this fee can be charged to, and who already is. */
export const GET = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await feeService.eligibleLearners({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/finance/fees/${id}/learners` });
  }
});

/** POST /api/finance/fees/[id]/learners — charge learners ({ studentIds }), e.g. those going on a trip. */
export const POST = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = feeLearnersSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.success(await feeService.addLearners({ userId: user.userId, role: user.role }, id, parsed.data.studentIds));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/finance/fees/${id}/learners` });
  }
});
