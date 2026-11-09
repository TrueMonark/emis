"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileImage, FileText, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/api-client";
import type { AttachmentInfo } from "./types";

const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * An announcement's files. They're private, so they're fetched with the sign-in token and opened
 * from the browser's memory (a new tab for PDFs and images), never from a public link.
 * `basePath` is "/api/announcements/<id>" (school) or "/api/office/announcements/<id>" (office).
 */
export function AttachmentList({ files, basePath }: { files: AttachmentInfo[]; basePath: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (files.length === 0) return null;

  const open = async (f: AttachmentInfo) => {
    // Open the tab now (while the click still counts as the person's own action), fill it later.
    const tab = window.open("", "_blank");
    setBusy(f.id);
    try {
      const res = await authFetch(`${basePath}/attachments/${f.id}`);
      if (!res.ok) throw new Error(res.status === 404 ? "File not found" : "Couldn't open the file");
      const url = URL.createObjectURL(await res.blob());
      if (tab) {
        tab.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = f.fileName;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      toast.error(e instanceof Error ? e.message : "Couldn't open the file");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => open(f)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {busy === f.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : f.mimeType === "application/pdf" ? (
              <FileText className="h-4 w-4 text-red-600" />
            ) : (
              <FileImage className="h-4 w-4 text-blue-600" />
            )}
            <span className="max-w-[16rem] truncate">{f.fileName}</span>
            <span className="text-xs text-muted-foreground">{size(f.sizeBytes)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
