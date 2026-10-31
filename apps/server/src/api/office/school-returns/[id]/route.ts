import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { returnsService } from "@/features/returns/returns.service";

/** GET /api/office/school-returns/[id] — one school's return, its history and what the office may do. */
export const GET = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await returnsService.officeGetReturn(officeContextOf(user), id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/office/school-returns/${id}` });
  }
});
