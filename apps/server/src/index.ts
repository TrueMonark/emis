// Starts the API server on its own (development, or a host that runs the API
// separately). For one-process hosting of API + school app, see /server.js.
import "dotenv/config"; // must load before anything reads process.env (Prisma does at import)
import { createApp } from "./app";
import prisma from "@/lib/db/prisma";
import { logger } from "@/lib/logger/logger";

const port = parseInt(process.env.PORT ?? "4000", 10);
const host = process.env.HOST ?? "0.0.0.0";

const server = createApp().listen(port, host, () => {
  logger.info(`API server ready on http://${host}:${port}`);
});
// Keep idle connections open longer than whatever sits in front of us (the
// school app's pass-through in development, nginx in split hosting) keeps
// them. With Node's 5s default, a proxy can reuse a connection at the moment
// we close it and the request fails with ECONNRESET (seen once in testing).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  // Don't hang forever on open keep-alive connections.
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
