import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf } from "@/features/offices/office.service";
import { returnsService } from "@/features/returns/returns.service";
import { openRoundSchema } from "@/features/returns/returns.validation";

/** GET /api/office/returns — the return rounds that reach this office's schools, with progress. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await returnsService.listRounds(officeContextOf(user)));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/returns" });
  }
});

/** POST /api/office/returns — the head of the office opens a return for its schools. */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = openRoundSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.created(await returnsService.openRound(officeContextOf(user), parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/office/returns" });
  }
});
