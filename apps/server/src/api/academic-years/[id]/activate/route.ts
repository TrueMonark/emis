import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { academicYearService } from "@/features/academic-years/academicYear.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * POST /api/academic-years/[id]/activate
 * Activate an academic year (deactivates all others)
 */
export const POST = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      const academicYear = await academicYearService.activateAcademicYear(id, context);

      return ApiResponse.success(academicYear);
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `POST /api/academic-years/${(await params).id}/activate`,
      });
    }
  }
);
