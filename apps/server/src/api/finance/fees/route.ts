import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { feeService } from "@/features/fees/fee.service";
import { createFeeSchema } from "@/features/fees/fees.validation";

/** GET /api/finance/fees?termId=&academicYearId=&archived=1 — fees with totals charged and paid (default: this year). */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    return ApiResponse.success(
      await feeService.listFees({ userId: user.userId, role: user.role }, { termId: q.get("termId"), academicYearId: q.get("academicYearId"), includeArchived: q.get("archived") === "1" })
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/fees" });
  }
});

/** POST /api/finance/fees — set up a fee (term fee, event, one-off) and charge it. */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = createFeeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.created(await feeService.createFee({ userId: user.userId, role: user.role }, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/finance/fees" });
  }
});
