import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { passwordResetService } from "@/features/password-resets/passwordReset.service";

/** POST /api/office/password-resets/[id]/reset — office head issues a one-time password. */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await passwordResetService.reset(id, { kind: "office", ctx: officeContextOf(user) }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/office/password-resets/${id}/reset` });
  }
});
