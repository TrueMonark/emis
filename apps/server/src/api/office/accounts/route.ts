import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf, officeService } from "@/features/offices/office.service";
import { createOfficeAccountSchema } from "@/features/offices/office.validation";

/** GET /api/office/accounts — office accounts this office can see. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await officeService.listAccounts(officeContextOf(user)));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/accounts" });
  }
});

/** POST /api/office/accounts — create an office account; the one-time password is in the response, once. */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = createOfficeAccountSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Invalid account"), parsed.error.flatten().fieldErrors);
    return ApiResponse.created(await officeService.createAccount(officeContextOf(user), parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/office/accounts" });
  }
});
