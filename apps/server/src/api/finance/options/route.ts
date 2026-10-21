import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { feeService } from "@/features/fees/fee.service";

/** GET /api/finance/options — years, terms, year levels, classes, categories; and whether the caller may edit. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    return ApiResponse.success(await feeService.options({ userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/options" });
  }
});
