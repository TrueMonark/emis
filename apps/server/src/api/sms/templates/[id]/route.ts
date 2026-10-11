import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { UnauthorizedError } from "@/lib/errors";
import { Role } from "@school/shared/types/prisma-enums";
import { smsService } from "@/features/sms/sms.service";

/** PUT /api/sms/templates/[id] — update template (admin only) */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (req, user) => {
    try {
      if (user.role !== Role.ADMIN) throw new UnauthorizedError("Admin only");
      const body = await request.json();
      const template = await smsService.updateTemplate(id, body, { userId: user.userId, role: user.role });
      return ApiResponse.success(template);
    } catch (error) {
      return handleApiError(error, { userId: user.userId, endpoint: `PUT /api/sms/templates/${id}` });
    }
  })(request);
}

/** DELETE /api/sms/templates/[id] — delete template (admin only) */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (req, user) => {
    try {
      if (user.role !== Role.ADMIN) throw new UnauthorizedError("Admin only");
      await smsService.deleteTemplate(id, { userId: user.userId, role: user.role });
      return ApiResponse.success({ message: "Template deleted" });
    } catch (error) {
      return handleApiError(error, { userId: user.userId, endpoint: `DELETE /api/sms/templates/${id}` });
    }
  })(request);
}
