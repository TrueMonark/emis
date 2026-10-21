import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { schoolSetupService } from "@/features/schools/schoolSetup.service";

/** POST /api/school/setup/complete — head/deputy finishes setup once the required steps are done. */
export const POST = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(
      await schoolSetupService.complete({ userId: user.userId, role: user.role })
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/school/setup/complete" });
  }
});
