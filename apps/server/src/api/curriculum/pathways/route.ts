import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import {
  nationalCurriculumService,
  setPathwaysSchema,
} from "@/features/national-curriculum/nationalCurriculum.service";

/** GET /api/curriculum/pathways — national O-level and A-level pathways, marked with what the school offers. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await nationalCurriculumService.listPathways());
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/curriculum/pathways" });
  }
});

/** PUT /api/curriculum/pathways — { pathwayIds } the school offers (head/deputy). */
export const PUT = withAuth(async (request: Request, user) => {
  try {
    const parsed = setPathwaysSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid pathways", parsed.error.flatten().fieldErrors);
    }
    const result = await nationalCurriculumService.setOfferedPathways(parsed.data.pathwayIds, {
      userId: user.userId,
      role: user.role,
    });
    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "PUT /api/curriculum/pathways" });
  }
});
