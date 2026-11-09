import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { sbaService } from "@/features/sba/sba.service";

/** POST /api/sba/[id]/confirm — the head teacher or deputy confirms an approved sheet. */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    return ApiResponse.success(await sbaService.confirm({ userId: user.userId, role: user.role }, id));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/sba/[id]/confirm`.replace("[id]", id) });
  }
});
