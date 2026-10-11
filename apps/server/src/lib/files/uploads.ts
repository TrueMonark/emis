import path from "node:path";
import { mkdir } from "node:fs/promises";

/**
 * Where uploaded files (the school logo today) are stored on disk.
 *
 * Set UPLOADS_DIR in production so uploads survive redeploys; the default is
 * an `uploads/` folder next to wherever the server was started.
 * The files are served publicly by the server at UPLOADS_URL_PREFIX
 * (see src/app.ts), so never store anything private here.
 */
export function uploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads"));
}

export const UPLOADS_URL_PREFIX = "/uploads";

/** Absolute path for an uploaded file, creating the uploads folder if needed. */
export async function uploadFilePath(filename: string): Promise<string> {
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  // basename() so a stored filename can never point outside the folder.
  return path.join(dir, path.basename(filename));
}
