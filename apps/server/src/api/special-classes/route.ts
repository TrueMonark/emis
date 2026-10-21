import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { specialClassService, type SpecialClassView } from "@/features/special-classes/specialClass.service";
import { createSpecialClassSchema } from "@/features/special-classes/specialClass.validation";

/** GET /api/special-classes?view=mine|to-approve|all — weekend classes (default: my own). */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const raw = new URL(request.url).searchParams.get("view");
    const view: SpecialClassView = raw === "to-approve" || raw === "all" ? raw : "mine";
    return ApiResponse.success(await specialClassService.list(view, { userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/special-classes" });
  }
});

/** POST /api/special-classes — a teacher asks for a weekend class (waits for the HOD). */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = createSpecialClassSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.created(await specialClassService.create(parsed.data, { userId: user.userId, role: user.role }));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/special-classes" });
  }
});
