import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { teacherService } from "@/features/teachers/teacher.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * POST /api/teachers/[id]/reset-password
 * Admin-only: reset a teacher's password to the default and notify them via SMS.
 */
export const POST = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      await teacherService.resetPassword(id, context);

      return ApiResponse.success({ message: "Password reset successfully" });
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `POST /api/teachers/${(await params).id}/reset-password`,
      });
    }
  }
);
