import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { returnsService } from "@/features/returns/returns.service";
import { saveDraftSchema } from "@/features/returns/returns.validation";

/** GET /api/school/returns/[roundId] — the round and this school's return (null until started). */
export const GET = withAuth(async (_request: Request, user, { params }) => {
  const { roundId } = await params;
  try {
    return ApiResponse.success(await returnsService.schoolGetReturn({ userId: user.userId, role: user.role }, roundId));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `GET /api/school/returns/${roundId}` });
  }
});

/** POST /api/school/returns/[roundId] — start the draft (figures from the records, facilities from the profile). */
export const POST = withAuth(async (_request: Request, user, { params }) => {
  const { roundId } = await params;
  try {
    return ApiResponse.created(await returnsService.start({ userId: user.userId, role: user.role }, roundId));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `POST /api/school/returns/${roundId}` });
  }
});

/** PATCH /api/school/returns/[roundId] — save the draft's facilities and remarks. */
export const PATCH = withAuth(async (request: Request, user, { params }) => {
  const { roundId } = await params;
  try {
    const parsed = saveDraftSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the return"));
    return ApiResponse.success(await returnsService.save({ userId: user.userId, role: user.role }, roundId, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: `PATCH /api/school/returns/${roundId}` });
  }
});
