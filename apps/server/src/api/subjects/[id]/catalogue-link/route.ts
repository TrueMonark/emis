import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import {
  linkSubjectSchema,
  nationalCurriculumService,
} from "@/features/national-curriculum/nationalCurriculum.service";

/** PUT /api/subjects/[id]/catalogue-link — { catalogueSubjectId | null } */
export const PUT = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = linkSubjectSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid catalogue link", parsed.error.flatten().fieldErrors);
    }
    const subject = await nationalCurriculumService.linkSubject(id, parsed.data.catalogueSubjectId, {
      userId: user.userId,
      role: user.role,
    });
    return ApiResponse.success(subject);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PUT /api/subjects/${id}/catalogue-link` });
  }
});
