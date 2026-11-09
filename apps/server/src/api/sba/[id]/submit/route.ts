import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { sbaService } from "@/features/sba/sba.service";

/** POST /api/sba/[id]/submit — the teacher sends the finished sheet to the HOD. */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await sbaService.submit({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/sba/[id]/submit`.replace("[id]", id) });
  }
});
