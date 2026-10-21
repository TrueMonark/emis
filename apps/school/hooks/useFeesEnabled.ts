"use client";

import { useEffect, useState } from "react";
import { isSchoolLeader } from "@school/shared/auth/role-hierarchy";
import { api } from "@/lib/api-client";

interface StoredUser {
  role?: string;
  school?: { feesEnabled?: boolean } | null;
}

function readStored(): StoredUser | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

/**
 * Whether the head teacher / deputy should see the "School fees" link: the school has the fees
 * module (always for private schools; the DEBS can switch it on). Checked with /auth/me, so a
 * change by the district office shows without signing in again.
 */
export function useFeesLink(): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const stored = readStored();
    if (!stored || !isSchoolLeader(stored.role ?? "")) return;
    api
      .get<{ data: { school?: { feesEnabled?: boolean } | null } }>("/auth/me")
      .then(({ data }) => {
        const enabled = !!data.school?.feesEnabled;
        setShow(enabled);
        if (enabled !== !!stored.school?.feesEnabled && stored.school) {
          localStorage.setItem("user", JSON.stringify({ ...stored, school: { ...stored.school, feesEnabled: enabled } }));
        }
      })
      .catch(() => undefined);
  }, []);
  return show;
}
