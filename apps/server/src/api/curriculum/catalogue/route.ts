import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import {
  addFromCatalogueSchema,
  nationalCurriculumService,
} from "@/features/national-curriculum/nationalCurriculum.service";

/** GET /api/curriculum/catalogue — the national subject list, marked with what the school offers. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await nationalCurriculumService.listCatalogue());
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/curriculum/catalogue" });
  }
});

/** POST /api/curriculum/catalogue — add national subjects to the school's subjects (head/deputy). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = addFromCatalogueSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Choose subjects to add", parsed.error.flatten().fieldErrors);
    }
    const result = await nationalCurriculumService.addFromCatalogue(parsed.data, {
      userId: user.userId,
      role: user.role,
    });
    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/curriculum/catalogue" });
  }
});
