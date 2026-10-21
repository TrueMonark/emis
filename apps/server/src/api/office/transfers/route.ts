import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { transferService } from "@/features/transfers/transfer.service";

/** GET /api/office/transfers — transfers waiting into or out of schools in this office's area. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await transferService.list({ kind: "office", ctx: officeContextOf(user) }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/transfers" });
  }
});
