import { withAuth } from "@/lib/http/with-auth";
import { handleApiError } from "@/lib/http/error-handler";
import { settingsService } from "@/features/settings/settings.service";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * GET /api/admin/settings/security
 * Get security settings
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const context: AuthContext = { userId: user.userId, role: user.role as Role };

    const settings = await settingsService.getSettingsByCategory("security", context);

    const settingsObject: Record<string, unknown> = {};
    settings.forEach((setting) => {
      settingsObject[setting.key] = setting.value;
    });

    if (Object.keys(settingsObject).length === 0) {
      const defaults = settingsService.getDefaultSettings("security");
      return Response.json({ settings: defaults });
    }

    return Response.json({ settings: settingsObject });
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/admin/settings/security" });
  }
});

/**
 * POST /api/admin/settings/security
 * Update security settings
 */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const context: AuthContext = { userId: user.userId, role: user.role as Role };
    const body = await request.json();

    await settingsService.setSettingsBatch({ category: "security", settings: body }, context);

    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/admin/settings/security" });
  }
});
