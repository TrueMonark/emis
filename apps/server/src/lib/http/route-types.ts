/**
 * A route handler is a plain web-standard function: it takes a `Request` and
 * returns a `Response`. This is the same shape the handlers had under Next.js,
 * minus the Next-specific types, so every route file moved over unchanged in
 * structure. The Express adapter (express-adapter.ts) converts to and from
 * Express's req/res at the edge.
 */
export interface RouteContext {
  params: Promise<Record<string, string>>;
}

// Each route's second argument is typed per-route (e.g. { params: Promise<{ id: string }> }).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteHandler = (request: Request, context: any) => Promise<Response>;

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** What a src/api/**\/route.ts file exports. */
export type RouteModule = Partial<Record<HttpMethod, RouteHandler>> & Record<string, unknown>;
