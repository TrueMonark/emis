import { useMemo, useSyncExternalStore } from "react";

/**
 * A tiny change signal: screens re-read the local database when it changes (after a sync or a
 * save). Data lives in SQLite; this only says "something changed".
 */
let version = 0;
const listeners = new Set<() => void>();

export function notifyDataChanged() {
  version++;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Changes whenever local data changes; use as a dependency to re-read. */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** Re-reads (synchronously, from SQLite) whenever local data changes or a dependency changes. */
export function useLocal<T>(read: () => T, deps: unknown[] = []): T {
  const v = useDataVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(read, [v, ...deps]);
}
