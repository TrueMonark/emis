import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { returnsService } from "@/features/returns/returns.service";

/** POST /api/school/returns/[roundId]/submit — send the return to the DEBS. */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { roundId } = await params;
  try {
    return ApiResponse.success(await returnsService.submit({ userId: user.userId, role: user.role }, roundId));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/school/returns/${roundId}/submit` });
  }
});
