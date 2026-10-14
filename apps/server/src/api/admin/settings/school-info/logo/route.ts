import { writeFile, unlink } from "fs/promises";
import { uploadFilePath, UPLOADS_URL_PREFIX } from "@/lib/files/uploads";
import sharp from "sharp";
import { withAuth } from "@/lib/http/with-auth";
import { handleApiError } from "@/lib/http/error-handler";
import { ForbiddenError, BadRequestError } from "@/lib/http/errors";
import { settingsService } from "@/features/settings/settings.service";
import { clearSchoolInfoCache } from "@/lib/settings/school-info-helper";
import { Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";

// The logo only ever needs to render small (a ~52pt slot in generated PDFs,
// a similarly small UI thumbnail), but it gets base64-embedded in every
// /api/admin/settings/school-info response and handed to a client-side PDF
// renderer — an uploaded multi-megabyte photo there previously broke mark
// schedule PDF generation for real (see git history). Every upload is
// therefore normalized server-side to a small raster PNG, regardless of
// what was uploaded (including SVG, which is rasterized) — this is a hard
// guarantee, not a size check the admin has to get right.
const LOGO_MAX_DIMENSION = 512;
const UPLOAD_MAX_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/admin/settings/school-info/logo
 * Upload school logo (admin only)
 */
export const POST = withAuth(async (request: Request, user) => {
  try {
    if (!isSchoolLeader(user.role)) {
      throw new ForbiddenError("Only admins can upload school logo");
    }
    const context: AuthContext = { userId: user.userId, role: user.role as Role };

    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      throw new BadRequestError("No file provided");
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      throw new BadRequestError("Invalid file type. Only PNG, JPG, and SVG are allowed.");
    }

    if (file.size > UPLOAD_MAX_SIZE) {
      throw new BadRequestError("File too large. Maximum size is 5MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Always normalize to a small PNG — decoding through sharp also rejects
    // anything that isn't actually a valid image, regardless of what the
    // browser claimed its MIME type was.
    let resized: Buffer;
    try {
      resized = await sharp(buffer)
        .resize(LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9, quality: 90 })
        .toBuffer();
    } catch {
      throw new BadRequestError("Could not process this file as an image.");
    }

    // One file per school, so schools never overwrite each other's logo.
    const filename = `school-logo-${user.schoolId}.png`;
    const publicPath = await uploadFilePath(filename);

    // Remove this school's previous logo file if it had a different name (e.g. the
    // single-school "school-logo.png"). Never touch other schools' files.
    const previous = await settingsService.getSetting("logoFilename", context);
    const previousFilename = typeof previous?.value === "string" ? previous.value : "";
    if (previousFilename && previousFilename !== filename) {
      try {
        await unlink(await uploadFilePath(previousFilename));
      } catch {
        // Ignore if file doesn't exist
      }
    }

    await writeFile(publicPath, resized);

    await settingsService.setSetting(
      { key: "logoFilename", value: filename, category: "school_info" },
      context
    );

    clearSchoolInfoCache();

    return Response.json({ success: true, filename, url: `${UPLOADS_URL_PREFIX}/${filename}` });
  } catch (error) {
    return handleApiError(error, {
      userId: user.userId,
      endpoint: "POST /api/admin/settings/school-info/logo",
    });
  }
});

/**
 * DELETE /api/admin/settings/school-info/logo
 * Delete school logo and revert to default
 */
export const DELETE = withAuth(async (request: Request, user) => {
  try {
    if (!isSchoolLeader(user.role)) {
      throw new ForbiddenError("Only admins can delete school logo");
    }
    const context: AuthContext = { userId: user.userId, role: user.role as Role };

    const setting = await settingsService.getSetting("logoFilename", context);
    const currentFilename = (setting?.value as string) || "";

    if (currentFilename) {
      try {
        await unlink(await uploadFilePath(currentFilename));
      } catch {
        // Ignore if file doesn't exist
      }
    }

    await settingsService.setSetting(
      { key: "logoFilename", value: "", category: "school_info" },
      context
    );

    clearSchoolInfoCache();

    return Response.json({ success: true });
  } catch (error) {
    return handleApiError(error, {
      userId: user.userId,
      endpoint: "DELETE /api/admin/settings/school-info/logo",
    });
  }
});
