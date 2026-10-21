import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { passwordResetService } from "@/features/password-resets/passwordReset.service";

/** GET /api/office/password-resets — open reset requests this office handles. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await passwordResetService.listOpen({ kind: "office", ctx: officeContextOf(user) }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/password-resets" });
  }
});
