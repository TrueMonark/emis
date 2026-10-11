import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { assessmentService } from "@/features/assessments/assessment.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * POST /api/assessments/[id]/reopen
 * Reopen a completed assessment (undo completion)
 */
export const POST = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      const assessment = await assessmentService.reopenAssessment(id, context);

      return ApiResponse.success(assessment);
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `POST /api/assessments/${(await params).id}/reopen`,
      });
    }
  }
);
