import { settingsService } from "@/features/settings/settings.service";
import { readFile } from "fs/promises";
import { join } from "path";
import { uploadsDir } from "@/lib/files/uploads";
import { SCHOOL_NAME_NOT_SET } from "@school/shared/format";
import { requireSchoolId } from "@/lib/db/tenant";
import { logger } from "@/lib/logger/logger";

/**
 * School Info Helper
 * Provides cached access to school information settings for use in PDFs and other documents
 */

export interface SchoolInfo {
  name: string;
  motto: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  principalName: string;
  foundedYear: string;
  studentCapacity: string;
  schoolType: string;
  registrationNumber: string;
  logoFilename: string;
}

// In-memory caches, one entry per school (never share one school's details with another).
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const infoCache = new Map<string, { info: SchoolInfo; at: number }>();
// Reading + encoding the logo on every PDF request is wasteful; the logo rarely changes.
const logoCache = new Map<string, { filename: string; base64: string | null }>();

/**
 * Get school information from settings
 * Uses in-memory cache to avoid repeated database queries
 */
export async function getSchoolInfo(): Promise<SchoolInfo> {
  const now = Date.now();
  const schoolId = requireSchoolId();

  // Return cached data if still valid
  const cached = infoCache.get(schoolId);
  if (cached && now - cached.at < CACHE_TTL) {
    return cached.info;
  }

  // Fetch from database using admin context (settings are public info)
  const settings = await settingsService.getSettingsByCategory("school_info", {
    userId: "system",
    role: "ADMIN",
  });

  // Convert array to object
  const settingsObject: Record<string, any> = {};
  settings.forEach((setting) => {
    settingsObject[setting.key] = setting.value;
  });

  // Use defaults if settings are empty
  const defaults = settingsService.getDefaultSettings("school_info");
  const merged = { ...defaults, ...settingsObject };

  // Build school info object
  const info: SchoolInfo = {
    name: merged.name || SCHOOL_NAME_NOT_SET,
    motto: merged.motto || "",
    address: merged.address || "",
    city: merged.city || "",
    province: merged.province || "",
    postalCode: merged.postalCode || "",
    phone: merged.phone || "",
    email: merged.email || "",
    website: merged.website || "",
    principalName: merged.principalName || "",
    foundedYear: merged.foundedYear || "",
    studentCapacity: merged.studentCapacity || "",
    schoolType: merged.schoolType || "Secondary",
    registrationNumber: merged.registrationNumber || "",
    logoFilename: merged.logoFilename || "",
  };

  infoCache.set(schoolId, { info, at: now });
  return info;
}

/**
 * Get the logo URL for use in PDFs and web pages
 */
export async function getSchoolLogoUrl(): Promise<string> {
  const info = await getSchoolInfo();
  return `/${info.logoFilename}`;
}

/**
 * Get the logo as a base64 data URI for use in server-side PDF generation.
 * Result is cached in memory so repeated PDF requests don't re-read the file.
 * Returns null if logo file doesn't exist.
 */
export async function getSchoolLogoBase64(): Promise<string | null> {
  try {
    const info = await getSchoolInfo();
    const schoolId = requireSchoolId();
    if (!info.logoFilename) return null;

    // Return cached value if the logo filename hasn't changed
    const cached = logoCache.get(schoolId);
    if (cached && cached.filename === info.logoFilename) {
      return cached.base64;
    }

    const logoPath = join(uploadsDir(), info.logoFilename);
    const logoBuffer = await readFile(logoPath);

    const ext = info.logoFilename.split(".").pop()?.toLowerCase();
    let mimeType = "image/png";
    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "svg") mimeType = "image/svg+xml";

    const base64 = `data:${mimeType};base64,${logoBuffer.toString("base64")}`;
    logoCache.set(schoolId, { filename: info.logoFilename, base64 });
    return base64;
  } catch (error) {
    logger.warn("School logo could not be loaded", {
      reason: error instanceof Error ? error.message : String(error),
    });
    // Cache the null so we don't retry on every request
    const info = await getSchoolInfo().catch(() => null);
    if (info) logoCache.set(requireSchoolId(), { filename: info.logoFilename, base64: null });
    return null;
  }
}

/**
 * Clear the cache (call this after updating school settings)
 */
export function clearSchoolInfoCache(): void {
  const schoolId = requireSchoolId();
  infoCache.delete(schoolId);
  logoCache.delete(schoolId);
}
