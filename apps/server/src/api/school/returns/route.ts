import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { returnsService } from "@/features/returns/returns.service";

/** GET /api/school/returns — the returns the offices have asked this school for, with its status in each. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await returnsService.schoolRounds({ userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/school/returns" });
  }
});
