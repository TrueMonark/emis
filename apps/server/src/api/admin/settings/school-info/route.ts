import { withAuth } from "@/lib/http/with-auth";
import { handleApiError } from "@/lib/http/error-handler";
import { settingsService } from "@/features/settings/settings.service";
import { getSchoolLogoBase64, clearSchoolInfoCache } from "@/lib/settings/school-info-helper";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * GET /api/admin/settings/school-info
 * Get school information settings
 *
 * Note: intentionally returns { settings, logoBase64 } at the top level
 * (not the standard ApiResponse envelope) — several existing pages read
 * this shape directly and non-defensively; see docs/ARCHITECTURAL_ANALYSIS.md.
 */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const context: AuthContext = { userId: user.userId, role: user.role as Role };

    const settings = await settingsService.getSettingsByCategory("school_info", context);

    const settingsObject: Record<string, unknown> = {};
    settings.forEach((setting) => {
      settingsObject[setting.key] = setting.value;
    });

    const logoBase64 = await getSchoolLogoBase64();

    if (Object.keys(settingsObject).length === 0) {
      const defaults = settingsService.getDefaultSettings("school_info");
      return Response.json({ settings: defaults, logoBase64: logoBase64 || undefined });
    }

    return Response.json({ settings: settingsObject, logoBase64: logoBase64 || undefined });
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/admin/settings/school-info" });
  }
});

/**
 * POST /api/admin/settings/school-info
 * Update school information settings
 */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const context: AuthContext = { userId: user.userId, role: user.role as Role };
    const body = await request.json();

    await settingsService.setSettingsBatch({ category: "school_info", settings: body }, context);
    clearSchoolInfoCache();

    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/admin/settings/school-info" });
  }
});
