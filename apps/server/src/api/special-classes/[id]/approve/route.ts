import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { specialClassService } from "@/features/special-classes/specialClass.service";
import { decideSpecialClassSchema } from "@/features/special-classes/specialClass.validation";

/** POST /api/special-classes/[id]/approve — the HOD (or head/deputy) decides ({ note? }). */
export const POST = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = decideSpecialClassSchema.safeParse(await request.json().catch(() => ({})));
    const note = parsed.success ? parsed.data.note ?? null : null;
    return ApiResponse.success(await specialClassService.approve(id, { userId: user.userId, role: user.role }, note));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/special-classes/${id}/approve` });
  }
});
