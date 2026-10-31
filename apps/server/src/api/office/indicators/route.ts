import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { indicatorsService } from "@/features/indicators/indicators.service";

/**
 * GET /api/office/indicators?officeId=&from=&to= — the School profile dashboard: figures for the
 * office's area by province (HQ), district (PEO) or school (DEBS). Counts only.
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    return ApiResponse.success(
      await indicatorsService.officeDashboard(officeContextOf(user), { officeId: q.get("officeId"), from: q.get("from"), to: q.get("to") })
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/indicators" });
  }
});
