import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { sbaService } from "@/features/sba/sba.service";
import { startSheetSchema } from "@/features/sba/sba.validation";

/** GET /api/sba — my SBA sheets this year; the department's (HOD) or the school's (head/deputy). */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await sbaService.overview({ userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/sba" });
  }
});

/** POST /api/sba — the teacher starts the sheet for a subject they teach in a class ({ classId, subjectId }). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = startSheetSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Choose the class and subject"));
    return ApiResponse.created(await sbaService.start({ userId: user.userId, role: user.role }, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/sba" });
  }
});
