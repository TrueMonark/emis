import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { requireSchoolId } from "@/lib/db/tenant";
import { transferService } from "@/features/transfers/transfer.service";

/**
 * GET /api/staff/lookup?q=<email or mobile> — find one existing person (exact match only) to add
 * to this school's staff. Head teacher / deputy only. Returns null when there's no such account.
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const person = await transferService.lookup(
      { kind: "school", userId: user.userId, role: user.role, schoolId: requireSchoolId() },
      q
    );
    return ApiResponse.success(person);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/staff/lookup" });
  }
});
