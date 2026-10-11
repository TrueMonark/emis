import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";
import { routes } from "./routes.generated";
import { adapt, sendWebResponse } from "@/lib/http/express-adapter";
import { HTTP_METHODS } from "@/lib/http/route-types";
import { ApiResponse } from "@/lib/http/api-response";
import { uploadsDir, UPLOADS_URL_PREFIX } from "@/lib/files/uploads";
import { logger } from "@/lib/logger/logger";

/**
 * Builds the API server: every src/api/**\/route.ts mounted at its URL,
 * uploaded files under /uploads, and JSON 404/405/500 answers for /api.
 *
 * Kept separate from index.ts (which only starts listening) so that the
 * all-in-one entry at the repo root (server.js) can mount the school app
 * behind the same Express instance, on one port.
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("case sensitive routing", true); // same as Next.js routing

  // Uploaded files (school logo). Public, read-only, no directory listings.
  app.use(
    UPLOADS_URL_PREFIX,
    express.static(uploadsDir(), { index: false, dotfiles: "deny", fallthrough: false })
  );

  const api = express.Router({ caseSensitive: true });
  // Keep the body as raw bytes; each handler reads it with request.json() /
  // request.formData() itself, exactly as it did under Next.js.
  api.use(express.raw({ type: () => true, limit: process.env.API_BODY_LIMIT ?? "10mb" }));

  for (const route of routes) {
    const allowed: string[] = [];
    for (const method of HTTP_METHODS) {
      const handler = route.handlers[method];
      if (!handler) continue;
      allowed.push(method);
      api[method.toLowerCase() as Lowercase<typeof method>](route.path, adapt(handler));
    }
    // The URL exists but not for this method.
    api.all(route.path, methodNotAllowed(allowed));
  }

  app.use(api);
  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}

function methodNotAllowed(allowed: string[]): RequestHandler {
  return (req, res, next) => {
    res.setHeader("Allow", allowed.join(", "));
    sendWebResponse(res, ApiResponse.error(`Method ${req.method} not allowed`, 405)).catch(next);
  };
}

const notFound: RequestHandler = (req, res, next) => {
  sendWebResponse(res, ApiResponse.notFound(`No API route for ${req.method} ${req.path}`)).catch(next);
};

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  // Body too large / malformed body, raised by express.raw before a handler ran.
  const status = typeof error?.status === "number" && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 404) {
    // express.static with fallthrough: false — the file isn't there.
    res.status(404).end();
    return;
  }
  if (status === 500) {
    logger.error("Unhandled server error", error instanceof Error ? error : new Error(String(error)), {
      path: req.originalUrl,
    });
  }
  const message = status === 413 ? "Request body too large" : status === 500 ? "Internal server error" : "Bad request";
  sendWebResponse(res, ApiResponse.error(message, status)).catch(() => res.end());
};
