import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { indicatorsService } from "@/features/indicators/indicators.service";

/** GET /api/school/profile?from=&to= — the school's own profile figures beside its district's (head/deputy). */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    return ApiResponse.success(
      await indicatorsService.mySchoolProfile({ userId: user.userId, role: user.role }, { from: q.get("from"), to: q.get("to") })
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/school/profile" });
  }
});
