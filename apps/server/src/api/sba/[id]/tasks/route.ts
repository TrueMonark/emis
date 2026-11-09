import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { sbaService } from "@/features/sba/sba.service";
import { updateTasksSchema } from "@/features/sba/sba.validation";

/** PATCH /api/sba/[id]/tasks — the teacher names the tasks, their dates and what each is out of. */
export const PATCH = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = updateTasksSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.success(await sbaService.updateTasks({ userId: user.userId, role: user.role }, id, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PATCH /api/sba/[id]/tasks`.replace("[id]", id) });
  }
});
