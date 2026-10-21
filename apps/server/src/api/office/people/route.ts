import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { transferService } from "@/features/transfers/transfer.service";

/**
 * GET /api/office/people?q=<email or mobile> — find one existing person (exact match), e.g. to
 * appoint them head of a new school. Office heads only.
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return ApiResponse.success(await transferService.lookup({ kind: "office", ctx: officeContextOf(user) }, q));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/people" });
  }
});
