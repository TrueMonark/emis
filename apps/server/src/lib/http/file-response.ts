/**
 * A file download (Phase 8: announcement attachments). PDFs and images open in the browser
 * ("inline"); the name is sent both plain (ASCII) and UTF-8 encoded. Never cached by shared
 * caches: these are private files.
 */
export function fileResponse(bytes: Buffer, fileName: string, mimeType: string): Response {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
