import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { assessmentService } from "@/features/assessments/assessment.service";
import { Role } from "@school/shared/types/prisma-enums";

/**
 * GET /api/assessments/[id]/history?studentId= — every entry, change and deletion of the
 * assessment's marks (web or phone), newest first. Same people as the results themselves.
 */
export const GET = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const studentId = new URL(request.url).searchParams.get("studentId");
    return ApiResponse.success(await assessmentService.getMarksHistory(id, { userId: user.userId, role: user.role as Role }, studentId));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/assessments/${id}/history` });
  }
});
