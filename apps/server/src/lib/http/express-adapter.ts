import type { Request as ExpressRequest, Response as ExpressResponse, RequestHandler } from "express";
import type { RouteHandler } from "./route-types";

/** Express req → web-standard Request (what every route handler receives). */
export function toWebRequest(req: ExpressRequest): Request {
  const host = req.get("host") ?? "localhost";
  const url = `${req.protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
    else headers.set(name, value);
  }
  // The login rate limiter (lib/http/rate-limit.ts) keys on the client IP from
  // x-forwarded-for / x-real-ip. When nothing in front of us set either, use
  // the connection's own address so clients don't all share one bucket.
  if (!headers.has("x-forwarded-for") && !headers.has("x-real-ip") && req.socket.remoteAddress) {
    headers.set("x-real-ip", req.socket.remoteAddress);
  }

  // The raw body parser (see app.ts) leaves the body as a Buffer so each
  // handler can read it as JSON, form data or text, exactly as before.
  const hasBody =
    req.method !== "GET" && req.method !== "HEAD" && Buffer.isBuffer(req.body) && req.body.length > 0;

  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? new Uint8Array(req.body as Buffer) : undefined,
  });
}

/** web-standard Response → Express res. */
export async function sendWebResponse(res: ExpressResponse, response: Response): Promise<void> {
  res.status(response.status);

  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") res.setHeader(name, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);

  if (!response.body) {
    res.end();
    return;
  }
  // Responses here are JSON, CSV, PDF or ZIP built in memory, so buffering is fine.
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** Wrap a route handler so Express can call it. Errors go to Express's error handler. */
export function adapt(handler: RouteHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      const response = await handler(toWebRequest(req), { params: Promise.resolve({ ...req.params }) });
      await sendWebResponse(res, response);
    } catch (error) {
      next(error);
    }
  };
}
