import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { requireSchoolId } from "@/lib/db/tenant";
import { passwordResetService } from "@/features/password-resets/passwordReset.service";

/** POST /api/password-resets/[id]/reset — issue a one-time password for an open request. */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const issued = await passwordResetService.reset(id, {
      kind: "school",
      userId: user.userId,
      role: user.role,
      schoolId: requireSchoolId(),
    });
    return ApiResponse.success(issued);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/password-resets/${id}/reset` });
  }
});
