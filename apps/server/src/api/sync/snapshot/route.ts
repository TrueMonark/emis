import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { phoneSyncService } from "@/features/sync/sync.service";

/**
 * GET /api/sync/snapshot — everything a teacher's phone holds (their classes, learners' names,
 * timetable, assessments and marks, this term's registers, weekend classes), with the cursor to
 * pull changes from and the scope fingerprint.
 */
export const GET = withAuth(async (_request: Request, user) => {
  try {
    return ApiResponse.success(await phoneSyncService.snapshot(user.userId, user.role));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/sync/snapshot" });
  }
});
