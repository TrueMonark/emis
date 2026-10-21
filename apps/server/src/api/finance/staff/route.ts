import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { financeStaffService } from "@/features/fees/financeStaff.service";
import { createFinanceStaffSchema } from "@/features/fees/fees.validation";

/** GET /api/finance/staff — finance staff accounts of the school. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    return ApiResponse.success(await financeStaffService.list({ userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/staff" });
  }
});

/** POST /api/finance/staff — the head or deputy creates a finance staff account (one-time password). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = createFinanceStaffSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.created(await financeStaffService.create({ userId: user.userId, role: user.role }, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/finance/staff" });
  }
});
