import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { yearLevelInputSchema, yearLevelService } from "@/features/grade-levels/yearLevel.service";

/** GET /api/year-levels — this school's year levels in order, with class counts. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await yearLevelService.list());
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/year-levels" });
  }
});

/** POST /api/year-levels — add a year level (head/deputy). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = yearLevelInputSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid year level", parsed.error.flatten().fieldErrors);
    }
    const level = await yearLevelService.create(parsed.data, { userId: user.userId, role: user.role });
    return ApiResponse.created(level);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/year-levels" });
  }
});
