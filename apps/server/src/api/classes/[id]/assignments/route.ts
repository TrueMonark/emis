import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { subjectTeacherAssignmentService } from "@/features/subject-teacher-assignments/subjectTeacherAssignment.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * GET /api/classes/[id]/assignments
 * Get assignments for a class
 */
export const GET = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      const searchParams = new URL(request.url).searchParams;
      const academicYearId = searchParams.get("academicYearId") || undefined;

      const assignments = await subjectTeacherAssignmentService.getClassAssignments(
        id,
        academicYearId,
        context
      );

      return ApiResponse.success(assignments);
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `GET /api/classes/${(await params).id}/assignments`,
      });
    }
  }
);
