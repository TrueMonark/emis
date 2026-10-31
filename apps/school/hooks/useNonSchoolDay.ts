"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export interface NonSchoolDay {
  date: string;
  kind: "PUBLIC_HOLIDAY" | "SCHOOL_CLOSURE";
  name: string;
}

// One request per day per page load.
const cache = new Map<string, Promise<NonSchoolDay | null>>();

function load(date: string): Promise<NonSchoolDay | null> {
  let p = cache.get(date);
  if (!p) {
    p = api
      .get<{ data: NonSchoolDay[] }>(`/calendar/non-school-days?from=${date}&to=${date}`)
      .then(({ data }) => data[0] ?? null)
      .catch(() => {
        cache.delete(date);
        return null;
      });
    cache.set(date, p);
  }
  return p;
}

/**
 * Whether a weekday is a public holiday or a school closure day (Phase 5b), for the register
 * pages. `date` is YYYY-MM-DD; null while loading or on an ordinary school day. The server
 * refuses registers on those days whatever the screen shows.
 */
export function useNonSchoolDay(date: string | null): NonSchoolDay | null {
  const [state, setState] = useState<{ date: string | null; day: NonSchoolDay | null }>({ date: null, day: null });
  useEffect(() => {
    if (!date) return;
    let active = true;
    load(date).then((day) => {
      if (active) setState({ date, day });
    });
    return () => {
      active = false;
    };
  }, [date]);
  return state.date === date ? state.day : null;
}

/** "Independence Day (public holiday)" / "Mid-term break (school closed)" */
export const nonSchoolDayLabel = (d: NonSchoolDay) =>
  `${d.name} (${d.kind === "PUBLIC_HOLIDAY" ? "public holiday" : "school closed"})`;

/** Fetch for a one-off check (forms). */
export const fetchNonSchoolDay = load;
