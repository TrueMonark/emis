import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { transferService } from "@/features/transfers/transfer.service";

/** POST /api/office/transfers/[id]/confirm — the office over the old school confirms a transfer. */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await transferService.confirm(id, { kind: "office", ctx: officeContextOf(user) }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/office/transfers/${id}/confirm` });
  }
});
