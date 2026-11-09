import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";

/**
 * Private files (announcement attachments, Phase 8): kept on disk in PRIVATE_FILES_DIR (default
 * `private-files/` next to wherever the server was started) and **never served statically**.
 * They are only ever sent by a route that has checked who is asking. Unlike `uploads/` (public).
 *
 * Files are stored under a random key with no extension, so a stored name can't be guessed or
 * point outside the folder; the original name and type live in the database.
 */
export function privateFilesDir(): string {
  return path.resolve(process.env.PRIVATE_FILES_DIR ?? path.join(process.cwd(), "private-files"));
}

function keyPath(key: string): string {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid private file key");
  return path.join(privateFilesDir(), key);
}

/** Store bytes; returns the key to keep in the database. */
export async function savePrivateFile(bytes: Buffer): Promise<string> {
  await mkdir(privateFilesDir(), { recursive: true });
  const key = randomUUID();
  await writeFile(keyPath(key), bytes, { flag: "wx" });
  return key;
}

export function readPrivateFile(key: string): Promise<Buffer> {
  return readFile(keyPath(key));
}

/** Remove a stored file (e.g. when saving the record failed). Missing files are ignored. */
export async function deletePrivateFile(key: string): Promise<void> {
  try {
    await unlink(keyPath(key));
  } catch {
    // already gone
  }
}
