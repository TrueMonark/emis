import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { phoneSyncService, pushSchema } from "@/features/sync/sync.service";
import type { Role } from "@prisma/client";

/**
 * POST /api/sync/push — the phone's queued operations:
 *   { deviceId?, operations: [{ opId, type, payload, madeAt? }] }
 * Answers one result per operation ({ opId, status: applied | rejected | in_progress, error? }).
 * Resending an operation with the same opId returns its first answer and changes nothing.
 */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = pushSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Send { operations: [...] }"));
    return ApiResponse.success(await phoneSyncService.push(user.userId, user.role as Role, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/sync/push" });
  }
});
