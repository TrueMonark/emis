import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { indicatorsService } from "@/features/indicators/indicators.service";
import { facilitiesSchema } from "@/features/indicators/indicators.validation";

/** PUT /api/school/profile/facilities — the head or deputy updates classrooms, desks, toilets, water, power. */
export const PUT = withAuth(async (request: Request, user) => {
  try {
    const parsed = facilitiesSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the facilities"));
    return ApiResponse.success(await indicatorsService.updateFacilities({ userId: user.userId, role: user.role }, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "PUT /api/school/profile/facilities" });
  }
});
