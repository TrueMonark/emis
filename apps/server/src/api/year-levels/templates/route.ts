import { z } from "zod";
import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { yearLevelService } from "@/features/grade-levels/yearLevel.service";

/** GET /api/year-levels/templates — the ready-made year level sets. */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(yearLevelService.listTemplates());
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/year-levels/templates" });
  }
});

const applySchema = z.object({ template: z.string().min(1) });

/** POST /api/year-levels/templates — add a template's levels the school doesn't have yet. */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = applySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Choose a template", parsed.error.flatten().fieldErrors);
    }
    const result = await yearLevelService.applyTemplate(parsed.data.template, {
      userId: user.userId,
      role: user.role,
    });
    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/year-levels/templates" });
  }
});
