import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { UnauthorizedError } from "@/lib/errors";
import { Role } from "@school/shared/types/prisma-enums";
import { smsService } from "@/features/sms/sms.service";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";

/** GET /api/sms/templates — all active templates (teacher+) */
export async function GET(request: Request) {
  return withAuth(async (req, user) => {
    try {
      const templates = await smsService.getTemplates({ userId: user.userId, role: user.role as Role });
      return ApiResponse.success(templates);
    } catch (error) {
      return handleApiError(error, { userId: user.userId, endpoint: "GET /api/sms/templates" });
    }
  })(request);
}

/** POST /api/sms/templates — create template (admin only) */
export async function POST(request: Request) {
  return withAuth(async (req, user) => {
    try {
      if (!isSchoolLeader(user.role)) throw new UnauthorizedError("Admin only");
      const body = await request.json();
      const template = await smsService.createTemplate(body, { userId: user.userId, role: user.role as Role });
      return ApiResponse.success(template);
    } catch (error) {
      return handleApiError(error, { userId: user.userId, endpoint: "POST /api/sms/templates" });
    }
  })(request);
}
