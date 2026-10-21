import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { feeService } from "@/features/fees/fee.service";

/** DELETE /api/finance/fees/[id]/learners/[studentId] — remove a learner's charge (only if nothing was paid towards it). */
export const DELETE = withAuth(async (request: Request, user, { params }) => {
  const { id, studentId } = await params;
  try {
    return ApiResponse.success(await feeService.removeLearner({ userId: user.userId, role: user.role }, id, studentId));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `DELETE /api/finance/fees/${id}/learners/${studentId}` });
  }
});
