import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { schoolSetupService } from "@/features/schools/schoolSetup.service";

/** GET /api/school/setup — the school's first-time setup steps and whether they're done. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await schoolSetupService.getStatus());
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/school/setup" });
  }
});
