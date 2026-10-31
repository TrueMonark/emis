import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { officeContextOf } from "@/features/offices/office.service";
import { indicatorsService } from "@/features/indicators/indicators.service";

/** GET /api/office/schools/[id]/profile?from=&to= — one school's figures beside its district's. */
export const GET = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const q = new URL(request.url).searchParams;
    return ApiResponse.success(await indicatorsService.officeSchoolProfile(officeContextOf(user), id, { from: q.get("from"), to: q.get("to") }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/office/schools/${id}/profile` });
  }
});
