import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { UnauthorizedError } from "@/lib/errors";
import { Role } from "@school/shared/types/prisma-enums";
import { hasRoleAuthority } from "@school/shared/auth/role-hierarchy";
import { assessmentWindowService } from "@/features/assessment-windows/assessmentWindow.service";

/**
 * GET /api/assessment-windows?termId=&examType=
 *
 * Returns the configured window for a term+examType and the current state:
 *   state: "before_open" | "open" | "closed" | "not_configured"
 */
export async function GET(request: Request) {
  return withAuth(async (req, user) => {
    try {
      if (!hasRoleAuthority(user.role as Role, Role.TEACHER)) throw new UnauthorizedError();

      const termId = new URL(req.url).searchParams.get("termId") ?? "";
      const examType = new URL(req.url).searchParams.get("examType") ?? "";

      const result = await assessmentWindowService.getWindowState(termId, examType);

      return ApiResponse.success(result);
    } catch (error) {
      return handleApiError(error, { userId: user.userId, endpoint: "GET /api/assessment-windows" });
    }
  })(request);
}
