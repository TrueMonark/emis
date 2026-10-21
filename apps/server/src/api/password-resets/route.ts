import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { requireSchoolId } from "@/lib/db/tenant";
import { passwordResetService } from "@/features/password-resets/passwordReset.service";

/** GET /api/password-resets — open "Forgot password?" requests for this school's head/deputy. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    const rows = await passwordResetService.listOpen({
      kind: "school",
      userId: user.userId,
      role: user.role,
      schoolId: requireSchoolId(),
    });
    return ApiResponse.success(rows);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/password-resets" });
  }
});
