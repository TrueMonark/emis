import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { accountService } from "@/features/fees/account.service";

/** GET /api/finance/reports/debtors?classId=&gradeId=&overdue=1&min= — who owes, largest first. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    const min = Number(q.get("min"));
    return ApiResponse.success(
      await accountService.debtors({ userId: user.userId, role: user.role }, {
        classId: q.get("classId"),
        gradeId: q.get("gradeId"),
        overdueOnly: q.get("overdue") === "1",
        minNgwee: Number.isFinite(min) && min > 0 ? Math.round(min) : undefined,
      })
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/reports/debtors" });
  }
});
