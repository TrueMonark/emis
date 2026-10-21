import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { specialClassService } from "@/features/special-classes/specialClass.service";

/** GET /api/special-classes/options — the classes and subjects you can ask for a weekend class for. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await specialClassService.options({ userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/special-classes/options" });
  }
});
