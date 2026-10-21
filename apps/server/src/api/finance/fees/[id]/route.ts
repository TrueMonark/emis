import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { feeService } from "@/features/fees/fee.service";
import { updateFeeSchema } from "@/features/fees/fees.validation";

/** GET /api/finance/fees/[id] — a fee and every learner charged it, with what they paid. */
export const GET = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await feeService.getFee({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/finance/fees/${id}` });
  }
});

/** PATCH /api/finance/fees/[id] — change name, amount (charges follow), due date, payment plan or archive it. */
export const PATCH = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = updateFeeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.success(await feeService.updateFee({ userId: user.userId, role: user.role }, id, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PATCH /api/finance/fees/${id}` });
  }
});

/** DELETE /api/finance/fees/[id] — only a fee nobody has been charged. */
export const DELETE = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await feeService.deleteFee({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `DELETE /api/finance/fees/${id}` });
  }
});
