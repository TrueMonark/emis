import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { accountService } from "@/features/fees/account.service";

/** GET /api/finance/overview — the finance dashboard (totals, today's and this month's collections, classes owing). */
export const GET = withAuth(async (request: Request, user) => {
  try {
    return ApiResponse.success(await accountService.overview({ userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/overview" });
  }
});
