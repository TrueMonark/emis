import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { phoneSyncService } from "@/features/sync/sync.service";

/**
 * GET /api/sync/changes?cursor=<cursor>&scope=<fingerprint>&limit=500 — what changed in the
 * teacher's scope since the cursor (rows with their current fields, and deletions). Answers
 * { resyncRequired: true } when the phone must take a new snapshot instead.
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    const limit = Number(q.get("limit") ?? 500);
    return ApiResponse.success(
      await phoneSyncService.changes(user.userId, user.role, q.get("cursor"), q.get("scope"), Number.isFinite(limit) ? limit : 500)
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/sync/changes" });
  }
});
