import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { nationalCurriculumService } from "@/features/national-curriculum/nationalCurriculum.service";

/** GET /api/classes/[id]/pathway-check — warnings when the class's subjects don't fit its pathway. */
export const GET = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await nationalCurriculumService.checkClassPathway(id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/classes/${id}/pathway-check` });
  }
});
