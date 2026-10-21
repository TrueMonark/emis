import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { requireSchoolId } from "@/lib/db/tenant";
import { transferService } from "@/features/transfers/transfer.service";

/** POST /api/transfers/[id]/decline — the person's current school declines their transfer out. */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(
      await transferService.decline(id, { kind: "school", userId: user.userId, role: user.role, schoolId: requireSchoolId() })
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/transfers/${id}/decline` });
  }
});
