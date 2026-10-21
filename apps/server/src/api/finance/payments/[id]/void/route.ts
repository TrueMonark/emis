import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { paymentService } from "@/features/fees/payment.service";
import { voidPaymentSchema } from "@/features/fees/fees.validation";

/** POST /api/finance/payments/[id]/void — cancel a wrong payment ({ reason }); it stays on record. */
export const POST = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = voidPaymentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Say why it's being cancelled"));
    return ApiResponse.success(await paymentService.void({ userId: user.userId, role: user.role }, id, parsed.data.reason));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/finance/payments/${id}/void` });
  }
});
