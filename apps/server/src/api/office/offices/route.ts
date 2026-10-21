import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf, officeService } from "@/features/offices/office.service";
import { createOfficeSchema } from "@/features/offices/office.validation";

/** GET /api/office/offices — offices this office can see, with their current accounts. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await officeService.listOffices(officeContextOf(user)));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/offices" });
  }
});

/** POST /api/office/offices — add a district office (PEO in its province; HQ in any). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = createOfficeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Invalid office"), parsed.error.flatten().fieldErrors);
    return ApiResponse.created(await officeService.createDistrictOffice(officeContextOf(user), parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/office/offices" });
  }
});
