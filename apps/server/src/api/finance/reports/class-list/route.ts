import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { accountService } from "@/features/fees/account.service";
import { ValidationError } from "@/lib/http/errors";

/** GET /api/finance/reports/class-list?classId=&termId=&feeIds=a,b — class list with payments on the side. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    const classId = q.get("classId");
    if (!classId) throw new ValidationError("Choose a class");
    const feeIds = (q.get("feeIds") ?? "").split(",").filter(Boolean);
    return ApiResponse.success(await accountService.classList({ userId: user.userId, role: user.role }, { classId, termId: q.get("termId"), feeIds }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/reports/class-list" });
  }
});
