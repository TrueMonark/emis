import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { accountService } from "@/features/fees/account.service";

/** GET /api/finance/learners?classId=&gradeId=&q=&owing=1 — this year's learners with balances. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    return ApiResponse.success(
      await accountService.learners({ userId: user.userId, role: user.role }, { classId: q.get("classId"), gradeId: q.get("gradeId"), q: q.get("q"), owing: q.get("owing") === "1" })
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/learners" });
  }
});
