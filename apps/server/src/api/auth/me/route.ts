import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { NotFoundError } from "@/lib/http/errors";
import { authService } from "@/features/auth/auth.service";

/**
 * GET /api/auth/me
 * Get current authenticated user's data
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const userData = await authService.getCurrentUser(user.userId);

    if (!userData) {
      throw new NotFoundError("User not found or inactive.");
    }

    const [school, office, pendingTransfer] = await Promise.all([
      authService.getSchoolSummary(user.userId),
      authService.getOfficeSummary(user.userId),
      authService.getPendingTransfer(user.userId),
    ]);

    return ApiResponse.success({
      id: userData.id,
      displayName: userData.displayName ?? null,
      school,
      office,
      /** A transfer to another school waiting for confirmation (they keep working here until then) */
      pendingTransfer,
      email: userData.email,
      phone: userData.phone ?? null,
      role: userData.role,
      isActive: userData.isActive,
      hasDefaultPassword: userData.hasDefaultPassword,
      lastLogin: userData.lastLogin,
      profile: userData.profile
        ? {
            id: userData.profile.id,
            staffNumber: userData.profile.staffNumber,
            firstName: userData.profile.firstName,
            middleName: userData.profile.middleName,
            lastName: userData.profile.lastName,
            phone: userData.profile.phone,
            status: userData.profile.status,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/auth/me" });
  }
});
