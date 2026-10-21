import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { feeService } from "@/features/fees/fee.service";
import { createDiscountSchema } from "@/features/fees/fees.validation";

/** GET /api/finance/discounts?studentId= — discounts and bursaries. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    return ApiResponse.success(await feeService.listDiscounts({ userId: user.userId, role: user.role }, q.get("studentId")));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/discounts" });
  }
});

/** POST /api/finance/discounts — give a learner a discount or bursary (charges this year are recalculated). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = createDiscountSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.created(await feeService.createDiscount({ userId: user.userId, role: user.role }, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/finance/discounts" });
  }
});
