import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf, officeService } from "@/features/offices/office.service";
import { createSchoolSchema } from "@/features/offices/office.validation";

/** GET /api/office/schools?q= — schools in this office's area. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams.get("q");
    return ApiResponse.success(await officeService.listSchools(officeContextOf(user), q));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/office/schools" });
  }
});

/** POST /api/office/schools — a DEBS registers a school with its first head teacher. */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = createSchoolSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Invalid school"), parsed.error.flatten().fieldErrors);
    return ApiResponse.created(await officeService.createSchool(officeContextOf(user), parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/office/schools" });
  }
});
