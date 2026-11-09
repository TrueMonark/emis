import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { sbaService } from "@/features/sba/sba.service";

/** GET /api/sba/[id]/score-sheet — what the printed score sheet shows (ECZ layout: last year's tasks and this year's). */
export const GET = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await sbaService.scoreSheet({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/sba/[id]/score-sheet`.replace("[id]", id) });
  }
});
