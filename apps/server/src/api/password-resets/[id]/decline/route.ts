import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { requireSchoolId } from "@/lib/db/tenant";
import { passwordResetService } from "@/features/password-resets/passwordReset.service";

/** POST /api/password-resets/[id]/decline — turn down a request (e.g. couldn't confirm who asked). */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const result = await passwordResetService.decline(id, {
      kind: "school",
      userId: user.userId,
      role: user.role,
      schoolId: requireSchoolId(),
    });
    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/password-resets/${id}/decline` });
  }
});
