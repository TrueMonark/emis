import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { UnauthorizedError } from "@/lib/errors";
import { Role } from "@school/shared/types/prisma-enums";
import { smsService } from "@/features/sms/sms.service";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";

/** POST /api/sms/templates/seed — seed default templates (admin only) */
export async function POST(request: Request) {
  return withAuth(async (req, user) => {
    try {
      if (!isSchoolLeader(user.role)) throw new UnauthorizedError("Admin only");
      await smsService.seedDefaultTemplates({ userId: user.userId, role: user.role as Role });
      return ApiResponse.success({ message: "Default templates seeded" });
    } catch (error) {
      return handleApiError(error, { userId: user.userId, endpoint: "POST /api/sms/templates/seed" });
    }
  })(request);
}
