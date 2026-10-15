import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import {
  nationalCurriculumService,
  setClassPathwaySchema,
} from "@/features/national-curriculum/nationalCurriculum.service";

/** PUT /api/classes/[id]/pathway — { pathwayId | null } (head/deputy). */
export const PUT = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = setClassPathwaySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid pathway", parsed.error.flatten().fieldErrors);
    }
    const cls = await nationalCurriculumService.setClassPathway(id, parsed.data.pathwayId, {
      userId: user.userId,
      role: user.role,
    });
    return ApiResponse.success(cls);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PUT /api/classes/${id}/pathway` });
  }
});
