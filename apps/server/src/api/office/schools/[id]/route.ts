import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf, officeService } from "@/features/offices/office.service";
import { updateSchoolSchema } from "@/features/offices/office.validation";

/** PATCH /api/office/schools/[id] — name, EMIS number and status, category, active/inactive. */
export const PATCH = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = updateSchoolSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Invalid school"), parsed.error.flatten().fieldErrors);
    return ApiResponse.success(await officeService.updateSchool(officeContextOf(user), id, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PATCH /api/office/schools/${id}` });
  }
});
