import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { settingsService } from "@/features/settings/settings.service";

/**
 * GET /api/school/identity
 * The school's display name for the sidebar header — any signed-in role.
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const identity = await settingsService.getSchoolIdentity();
    return ApiResponse.success(identity);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/school/identity" });
  }
});
