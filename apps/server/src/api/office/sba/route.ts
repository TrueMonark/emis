import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { sbaService } from "@/features/sba/sba.service";

/** GET /api/office/sba — SBA sheet progress for the office's schools this year (counts only, no marks). */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await sbaService.officeProgress(officeContextOf(user)));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/sba" });
  }
});
