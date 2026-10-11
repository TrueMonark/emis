import { withRole } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { academicPolicyService } from "@/features/settings/academicPolicy.service";
import type { AcademicPolicy } from "@school/shared/settings/academic-policy";

export type { AcademicPolicy };

export const GET = withRole(["ADMIN"], async (_request: Request, user) => {
  try {
    const policy = await academicPolicyService.getPolicy();
    return ApiResponse.success({ policy });
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/admin/settings/academic-policy" });
  }
});

export const POST = withRole(["ADMIN"], async (req: Request, user) => {
  try {
    const body: Partial<AcademicPolicy> = await req.json();
    const policy = await academicPolicyService.updatePolicy(body);
    return ApiResponse.success({ policy });
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/admin/settings/academic-policy" });
  }
});
