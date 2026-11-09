import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { sbaService } from "@/features/sba/sba.service";
import { centreCodeSchema } from "@/features/sba/sba.validation";

/** PUT /api/school/profile/centre-code — the head or deputy sets the school's ECZ centre code (on SBA score sheets). */
export const PUT = withAuth(async (request: Request, user) => {
  try {
    const parsed = centreCodeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the centre code"));
    return ApiResponse.success(await sbaService.setCentreCode({ userId: user.userId, role: user.role }, parsed.data.eczCentreCode));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "PUT /api/school/profile/centre-code" });
  }
});
