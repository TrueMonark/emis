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
    if (user.role !== "ADMIN") {
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

    const filename = "school-logo.png";
    const publicPath = await uploadFilePath(filename);

    // Clean up any logo saved under the old scheme (which kept the uploaded
    // extension) so a stale multi-MB file doesn't linger in the uploads folder.
    const oldExtensions = ["png", "jpg", "jpeg", "svg"];
    for (const ext of oldExtensions) {
      try {
        const oldPath = await uploadFilePath(`school-logo.${ext}`);
        await unlink(oldPath);
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
    if (user.role !== "ADMIN") {
      throw new ForbiddenError("Only admins can delete school logo");
    }
    const context: AuthContext = { userId: user.userId, role: user.role as Role };

    const setting = await settingsService.getSetting("logoFilename", context);
    const currentFilename = (setting?.value as string) || "school-logo.png";

    try {
      const logoPath = await uploadFilePath(currentFilename);
      await unlink(logoPath);
    } catch {
      // Ignore if file doesn't exist
    }

    await settingsService.setSetting(
      { key: "logoFilename", value: "school-logo.png", category: "school_info" },
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
