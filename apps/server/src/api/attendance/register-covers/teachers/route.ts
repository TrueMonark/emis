import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { registerCoverService } from "@/features/attendance/registerCover.service";
import { classIdQuerySchema } from "@/features/attendance/registerCover.validation";

/**
 * GET /api/attendance/register-covers/teachers?classId=
 * Active teachers at this school who can be handed the class's register.
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = classIdQuerySchema.safeParse({ classId: searchParams.get("classId") });
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters", parsed.error.flatten().fieldErrors);
    }
    const teachers = await registerCoverService.listCandidateTeachers(parsed.data.classId, {
      userId: user.userId,
      role: user.role,
    });
    return ApiResponse.success(teachers);
  } catch (error) {
    return handleApiError(error, {
      userId: user.userId,
      endpoint: "GET /api/attendance/register-covers/teachers",
    });
  }
});
