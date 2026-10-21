import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { paymentService } from "@/features/fees/payment.service";

/** GET /api/finance/payments/[id] — a receipt. */
export const GET = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await paymentService.receipt({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/finance/payments/${id}` });
  }
});
