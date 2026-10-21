"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

const ROLE_LABELS: Record<string, string> = {
  HEAD_TEACHER: "head teacher",
  DEPUTY_HEAD: "deputy head",
  TEACHER: "teacher",
  CLERK: "clerk",
};

/**
 * Someone with a transfer waiting for confirmation keeps working at their current school (Phase
 * 4b). Tells them once per sign-in session that it's waiting. Renders nothing.
 */
export function PendingTransferNotice() {
  useEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem("pendingTransferNoticeShown") === "1";
    } catch {
      // storage unavailable: show it (harmless)
    }
    if (shown) return;
    api
      .get<{ data: { pendingTransfer: { schoolName: string; role: string } | null } }>("/auth/me")
      .then((res) => {
        const t = res.data?.pendingTransfer;
        if (!t) return;
        toast.info(`Your transfer to ${t.schoolName} (${ROLE_LABELS[t.role] ?? t.role}) is waiting for confirmation.`, {
          description: "Keep working here until it's confirmed. You'll then move over automatically.",
          duration: 12000,
        });
        try {
          sessionStorage.setItem("pendingTransferNoticeShown", "1");
        } catch {
          // ignore
        }
      })
      .catch(() => undefined);
  }, []);
  return null;
}
