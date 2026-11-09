"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

/** Fired by the announcements page after reading or acknowledging, so menu badges update. */
export const ANNOUNCEMENTS_CHANGED_EVENT = "announcements-changed";

export function notifyAnnouncementsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ANNOUNCEMENTS_CHANGED_EVENT));
}

/**
 * Announcements waiting for this person (Phase 8): unread ones, plus, for the head and deputy,
 * ones the school still has to acknowledge. For the menu badge; refreshed when the window
 * comes back into focus and after reading one.
 */
export function useAnnouncementCounts() {
  const [counts, setCounts] = useState({ unread: 0, toAcknowledge: 0, attention: 0 });
  const load = useCallback(() => {
    api
      .get<{ data: { unread: number; toAcknowledge: number; attention: number } }>("/announcements/counts")
      .then(({ data }) => setCounts(data))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    window.addEventListener(ANNOUNCEMENTS_CHANGED_EVENT, load);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener(ANNOUNCEMENTS_CHANGED_EVENT, load);
    };
  }, [load]);
  return counts;
}
