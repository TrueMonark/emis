import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf, officeService } from "@/features/offices/office.service";

/** GET /api/office/audit — audit lines about this office's area, newest first. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await officeService.listAudit(officeContextOf(user)));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/audit" });
  }
});
