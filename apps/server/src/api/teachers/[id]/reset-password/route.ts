import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { teacherService } from "@/features/teachers/teacher.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * POST /api/teachers/[id]/reset-password
 * Head teacher / deputy head: issue a new one-time password for a teacher. The password is in
 * the response once (to hand over); the teacher must change it at next login.
 */
export const POST = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      const issued = await teacherService.resetPassword(id, context);

      return ApiResponse.success(issued);
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `POST /api/teachers/${(await params).id}/reset-password`,
      });
    }
  }
);
