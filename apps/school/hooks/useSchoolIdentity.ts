"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

// Fetched once per page load and shared by every component that asks.
let cached: Promise<string | null> | null = null;

function loadSchoolName(): Promise<string | null> {
  if (!cached) {
    cached = api
      .get<{ data: { name: string | null } }>("/school/identity")
      .then(({ data }) => data?.name ?? null)
      .catch(() => {
        cached = null; // try again next time
        return null;
      });
  }
  return cached;
}

/**
 * The name of the school the signed-in person works in (null until loaded, or when it hasn't
 * been entered in Settings → School Info).
 */
export function useSchoolName(): { name: string | null; loaded: boolean } {
  const [state, setState] = useState<{ name: string | null; loaded: boolean }>({
    name: null,
    loaded: false,
  });

  useEffect(() => {
    let active = true;
    loadSchoolName().then((name) => {
      if (active) setState({ name, loaded: true });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
