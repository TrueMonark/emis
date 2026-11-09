import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { sbaService } from "@/features/sba/sba.service";

/** GET /api/sba/[id] — the sheet: tasks, learners, marks, totals, history and what I may do. */
export const GET = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await sbaService.get({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/sba/${id}` });
  }
});
