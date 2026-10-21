import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf, officeService } from "@/features/offices/office.service";

/** GET /api/office/me — the signed-in person's office, role and headline counts. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await officeService.getMyOffice(officeContextOf(user)));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/me" });
  }
});
