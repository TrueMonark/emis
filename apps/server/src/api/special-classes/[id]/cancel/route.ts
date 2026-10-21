import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { specialClassService } from "@/features/special-classes/specialClass.service";

/** POST /api/special-classes/[id]/cancel — withdraw / call off (before its register is taken). */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await specialClassService.cancel(id, { userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/special-classes/${id}/cancel` });
  }
});
