import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { requireSchoolId } from "@/lib/db/tenant";
import { requestTransferSchema, transferService } from "@/features/transfers/transfer.service";

/** GET /api/transfers — transfers waiting into and out of this school (head/deputy). */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(
      await transferService.list({ kind: "school", userId: user.userId, role: user.role, schoolId: requireSchoolId() })
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/transfers" });
  }
});

/** POST /api/transfers — ask for an existing person to join this school ({ userId, role }). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = requestTransferSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    const result = await transferService.request(
      { kind: "school", userId: user.userId, role: user.role, schoolId: requireSchoolId() },
      parsed.data
    );
    return ApiResponse.created(result);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/transfers" });
  }
});
