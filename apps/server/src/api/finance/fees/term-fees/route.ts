import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { feeService } from "@/features/fees/fee.service";
import { termFeesSchema } from "@/features/fees/fees.validation";

/** POST /api/finance/fees/term-fees — one fee per year level for a term ({ termId, name, category, dueDate, amounts[] }). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = termFeesSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.created(await feeService.createTermFees({ userId: user.userId, role: user.role }, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/finance/fees/term-fees" });
  }
});
