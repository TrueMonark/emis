import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { financeStaffService } from "@/features/fees/financeStaff.service";

/** DELETE /api/finance/staff/[id] — end a finance staff account (membership id). */
export const DELETE = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await financeStaffService.end({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `DELETE /api/finance/staff/${id}` });
  }
});
