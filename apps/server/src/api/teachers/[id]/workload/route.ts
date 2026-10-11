import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { subjectTeacherAssignmentService } from "@/features/subject-teacher-assignments/subjectTeacherAssignment.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * GET /api/teachers/[id]/workload
 * Get teacher workload statistics
 */
export const GET = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      const searchParams = new URL(request.url).searchParams;
      const academicYearId = searchParams.get("academicYearId");

      if (!academicYearId) {
        return ApiResponse.badRequest("academicYearId is required");
      }

      const workload = await subjectTeacherAssignmentService.getTeacherWorkload(
        id,
        academicYearId,
        context
      );

      return ApiResponse.success(workload);
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `GET /api/teachers/${(await params).id}/workload`,
      });
    }
  }
);
