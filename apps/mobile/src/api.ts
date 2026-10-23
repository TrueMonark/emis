import { PASSWORD_CHANGE_REQUIRED, PASSWORD_CHANGE_REQUIRED_HEADER } from "@school/shared/auth/password-change";
import type { Session } from "./storage";

/** A failed call to the server, with the server's own message when it gave one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
  /** No answer at all (no signal, wrong address, server off) */
  get offline() {
    return this.status === 0;
  }
}

/** "192.168.1.20:4000" → "http://192.168.1.20:4000" (no trailing slash). */
export function normaliseServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/api$/i, "");
}

export async function request<T>(
  serverUrl: string,
  path: string,
  options: { method?: string; body?: unknown; token?: string | null; timeoutMs?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);
  let response: Response;
  try {
    response = await fetch(`${serverUrl}/api${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection (and the server address).", 0);
  } finally {
    clearTimeout(timer);
  }
  const json = (await response.json().catch(() => null)) as { success?: boolean; data?: T; error?: string; code?: string } | null;
  if (!response.ok || json?.success === false) {
    const code = json?.code ?? (response.headers.get(PASSWORD_CHANGE_REQUIRED_HEADER) ? PASSWORD_CHANGE_REQUIRED : undefined);
    throw new ApiError(json?.error ?? `The server answered ${response.status}`, response.status, code);
  }
  return (json && "data" in json ? json.data : json) as T;
}

/** A call as the signed-in teacher. */
export const call = <T>(session: Session, path: string, options: { method?: string; body?: unknown; timeoutMs?: number } = {}) =>
  request<T>(session.serverUrl, path, { ...options, token: session.token });
