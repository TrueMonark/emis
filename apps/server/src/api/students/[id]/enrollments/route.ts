import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { enrollmentService } from "@/features/enrollments/enrollment.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * GET /api/students/[id]/enrollments
 * Get student's enrollment history
 */
export const GET = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      const enrollments = await enrollmentService.getStudentEnrollmentHistory(id, context);

      return ApiResponse.success(enrollments);
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `GET /api/students/${(await params).id}/enrollments`,
      });
    }
  }
);
