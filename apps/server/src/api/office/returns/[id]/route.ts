import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { officeContextOf } from "@/features/offices/office.service";
import { returnsService } from "@/features/returns/returns.service";
import { roundStatusSchema } from "@/features/returns/returns.validation";

/** GET /api/office/returns/[id]?officeId= — a round's progress and approved totals. */
export const GET = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const officeId = new URL(request.url).searchParams.get("officeId");
    return ApiResponse.success(await returnsService.roundDetail(officeContextOf(user), id, officeId));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/office/returns/${id}` });
  }
});

/** PATCH /api/office/returns/[id] — close or reopen a round ({ status: "OPEN" | "CLOSED" }). */
export const PATCH = withAuth(async (request: Request, user, { params }) => {
  const { id } = await params;
  try {
    const parsed = roundStatusSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Choose OPEN or CLOSED"));
    return ApiResponse.success(await returnsService.setRoundStatus(officeContextOf(user), id, parsed.data.status));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PATCH /api/office/returns/${id}` });
  }
});
