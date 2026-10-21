import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { accountService } from "@/features/fees/account.service";
import { ValidationError } from "@/lib/http/errors";

/** GET /api/finance/reports/collections?from=YYYY-MM-DD&to=YYYY-MM-DD — money collected, by day, method and receiver. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    const from = q.get("from");
    const to = q.get("to");
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new ValidationError("Choose the dates (from and to)");
    }
    return ApiResponse.success(await accountService.collections({ userId: user.userId, role: user.role }, { from, to }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/reports/collections" });
  }
});
