import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { registerCoverService } from "@/features/attendance/registerCover.service";
import {
  classIdQuerySchema,
  createRegisterCoverSchema,
} from "@/features/attendance/registerCover.validation";

/**
 * GET /api/attendance/register-covers?classId=
 * Current and upcoming register covers for a class (class teacher or head/deputy).
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = classIdQuerySchema.safeParse({ classId: searchParams.get("classId") });
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters", parsed.error.flatten().fieldErrors);
    }
    const covers = await registerCoverService.listForClass(parsed.data.classId, {
      userId: user.userId,
      role: user.role,
    });
    return ApiResponse.success(covers);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/attendance/register-covers" });
  }
});

/**
 * POST /api/attendance/register-covers
 * Hand the class's morning register to another teacher for a set of days.
 */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = createRegisterCoverSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid register cover", parsed.error.flatten().fieldErrors);
    }
    const cover = await registerCoverService.create(parsed.data, {
      userId: user.userId,
      role: user.role,
    });
    return ApiResponse.created(cover);
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/attendance/register-covers" });
  }
});
