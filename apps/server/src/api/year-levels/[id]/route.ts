import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { yearLevelService, yearLevelUpdateSchema } from "@/features/grade-levels/yearLevel.service";

/** PATCH /api/year-levels/[id] — rename, change stage/curriculum/exam or the next level. */
export const PATCH = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = yearLevelUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid year level", parsed.error.flatten().fieldErrors);
    }
    const level = await yearLevelService.update(id, parsed.data, { userId: user.userId, role: user.role });
    return ApiResponse.success(level);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PATCH /api/year-levels/${id}` });
  }
});

/** DELETE /api/year-levels/[id] — only when it has no classes. */
export const DELETE = withAuth(async (_request: Request, user, { params }) => {
  const { id } = await params;
  try {
    await yearLevelService.remove(id, { userId: user.userId, role: user.role });
    return ApiResponse.success({ id, deleted: true });
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `DELETE /api/year-levels/${id}` });
  }
});
