import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { feeService } from "@/features/fees/fee.service";

/** POST /api/finance/fees/refresh — charge this year's fees to learners who joined since. */
export const POST = withAuth(async (request: Request, user) => {
  try {
    return ApiResponse.success(await feeService.refreshCharges({ userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/finance/fees/refresh" });
  }
});
