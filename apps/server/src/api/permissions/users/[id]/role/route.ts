import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { userManagementService } from "@/features/permissions/userManagement.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * PATCH /api/permissions/users/[id]/role
 * Update a user's role
 */
export const PATCH = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      const body = await request.json();
      const { role } = body;

      const updatedUser = await userManagementService.updateUserRole(id, role, context);

      return ApiResponse.success(updatedUser, { message: "User role updated successfully" });
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `PATCH /api/permissions/users/${(await params).id}/role`,
      });
    }
  }
);
