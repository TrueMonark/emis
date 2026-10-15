import { z } from "zod";
import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { yearLevelService } from "@/features/grade-levels/yearLevel.service";

const reorderSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

/** PUT /api/year-levels/reorder — { ids: [...] } first to last. */
export const PUT = withAuth(async (request: Request, user) => {
  try {
    const parsed = reorderSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Send the year levels in order", parsed.error.flatten().fieldErrors);
    }
    const levels = await yearLevelService.reorder(parsed.data.ids, { userId: user.userId, role: user.role });
    return ApiResponse.success(levels);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "PUT /api/year-levels/reorder" });
  }
});
