import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { officeContextOf, officeService } from "@/features/offices/office.service";
import { moveSchoolSchema } from "@/features/offices/office.validation";

/** PUT /api/office/schools/[id]/district — move a school to another district (HQ, or PEO in its province). */
export const PUT = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = moveSchoolSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError("Choose the district", parsed.error.flatten().fieldErrors);
    return ApiResponse.success(
      await officeService.moveSchool(officeContextOf(user), id, parsed.data.districtOfficeId)
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PUT /api/office/schools/${id}/district` });
  }
});
