import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf, officeService } from "@/features/offices/office.service";

/** DELETE /api/office/accounts/[id] — end someone's office role (the account itself stays). */
export const DELETE = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    await officeService.endAccount(officeContextOf(user), id);
    return ApiResponse.success({ id, ended: true });
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `DELETE /api/office/accounts/${id}` });
  }
});
