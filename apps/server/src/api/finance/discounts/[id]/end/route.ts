import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { feeService } from "@/features/fees/fee.service";

/** POST /api/finance/discounts/[id]/end — end a discount (charges this year go back up). */
export const POST = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await feeService.endDiscount({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/finance/discounts/${id}/end` });
  }
});
