import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { specialClassService } from "@/features/special-classes/specialClass.service";
import { specialClassRegisterSchema } from "@/features/special-classes/specialClass.validation";

/** GET /api/special-classes/[id]/register — the class list with any marks already taken. */
export const GET = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await specialClassService.getRegister(id, { userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/special-classes/${id}/register` });
  }
});

/** PUT /api/special-classes/[id]/register — take or correct the register ({ records }). */
export const PUT = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = specialClassRegisterSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the register"));
    return ApiResponse.success(await specialClassService.saveRegister(id, parsed.data, { userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PUT /api/special-classes/${id}/register` });
  }
});
