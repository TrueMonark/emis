import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf, officeService } from "@/features/offices/office.service";
import { updateOfficeSchema } from "@/features/offices/office.validation";

/** PATCH /api/office/offices/[id] — rename, change code, or close an office below this one. */
export const PATCH = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = updateOfficeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Invalid office"), parsed.error.flatten().fieldErrors);
    return ApiResponse.success(await officeService.updateOffice(officeContextOf(user), id, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PATCH /api/office/offices/${id}` });
  }
});
