/* eslint-disable @typescript-eslint/no-explicit-any --
   This client is intentionally untyped: `T` defaults to `any` and each call
   site narrows it (`api.get<Foo>(...)`). Defaulting to `unknown` would force a
   cast at every existing untyped UI call. Typed per-endpoint responses are the
   real fix; until then the untyped default is the contract. */
/**
 * API Client Utility
 *
 * Provides authenticated API request helpers for client-side calls.
 * Automatically includes JWT token from localStorage.
 */

import { PASSWORD_CHANGE_REQUIRED_HEADER } from "@school/shared/auth/password-change";

/**
 * Get auth token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

/**
 * `fetch` with the login token attached — a drop-in replacement for a plain
 * `fetch("/api/...")` that returns the raw Response, for callers that need it
 * (file downloads, or pages that inspect `response.ok` themselves).
 *
 * This is the ONE place the Authorization header is added. Prefer
 * `apiRequest` / `api.*` for ordinary JSON calls; never hand-roll
 * `Authorization: Bearer ...` in a screen.
 */
export function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers }).then((response) => {
    // The server refuses everything until a one-time password is changed; send the person
    // to the page where they can do that.
    if (
      response.status === 403 &&
      response.headers.get(PASSWORD_CHANGE_REQUIRED_HEADER) === "true" &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/change-password"
    ) {
      window.location.href = "/change-password";
    }
    return response;
  });
}

/**
 * Make authenticated API request
 *
 * @param endpoint - API endpoint path (with or without /api prefix)
 * @param options - Fetch options
 * @returns Promise with parsed JSON response
 * @throws Error if request fails
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Ensure endpoint starts with /api
  const url = endpoint.startsWith("/api") ? endpoint : `/api${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await authFetch(url, {
    ...options,
    headers,
  });

  // Handle non-JSON responses (e.g., HTML error pages)
  let data;
  try {
    data = await response.json();
  } catch (error) {
    // If response is not JSON, create error object
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  // Handle authentication errors
  if (response.status === 401) {
    // Clear invalid token
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      // Redirect to login
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please login again.");
  }

  // Check for ApiResponse envelope (handles both success and error cases)
  // Standard contract: { success: boolean, data?: T, meta?: any, error?: string }
  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      // API returned structured error with success=false
      throw new Error(data.error || 'API request failed');
    }
    // API returned success=true, return stable shape with data and optional meta
    return {
      data: data.data,
      meta: data.meta,
    } as unknown as T;
  }

  // Legacy: Handle non-ok responses without ApiResponse envelope
  if (!response.ok) {
    throw new Error(data.error || `API request failed: ${response.status}`);
  }

  // Return raw data for backwards compatibility
  return data;
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
