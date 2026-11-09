// All-in-one production entry: the API server and the school app as ONE
// process on ONE port — the same shape the host ran before (`node server.js`
// behind Passenger / Plesk on a platform-assigned PORT).
//
//   /api/*      → API server (apps/server)
//   /uploads/*  → uploaded files (school logo)
//   everything else → school app (apps/school)
//
// Build first: `npm run build`. Then: `npm start` (or `node server.js`).
// Each app can also run on its own instead — see README.md.
//
// Plain CommonJS on purpose, like the old server.js: some hosts load the
// startup file with require(). The API is an ES module, so it's loaded with
// import() below.
//
// Like the old server.js, this never falls back to dev mode, whatever
// NODE_ENV says (the host panel can't set it).
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const { createRequire } = require("module");
const dotenv = require("dotenv");

const serverDir = path.join(__dirname, "apps", "server");
const schoolDir = path.join(__dirname, "apps", "school");

// Server settings (DATABASE_URL, JWT_SECRET, SMS keys…) live in apps/server/.env.
dotenv.config({ path: path.join(serverDir, ".env"), quiet: true });
process.env.UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(serverDir, "uploads");
process.env.PRIVATE_FILES_DIR = process.env.PRIVATE_FILES_DIR || path.join(serverDir, "private-files");

const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

async function main() {
  // Load the API only after the environment is in place (Prisma reads it on import).
  const { createApp } = await import("@school/server/app");

  // `next` is resolved from the school app, which is what depends on it.
  const next = createRequire(path.join(schoolDir, "package.json"))("next");
  const school = next({ dev: false, dir: schoolDir, hostname, port });
  const handleSchool = school.getRequestHandler();
  await school.prepare();

  const app = createApp();
  // Anything the API didn't answer goes to the school app.
  app.use((req, res) => handleSchool(req, res));

  const httpServer = app.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port} (API + school app)`);
  });
  // Outlast the idle-connection timeout of the host's front proxy (Passenger /
  // nginx), so it never reuses a connection at the moment we close it.
  httpServer.keepAliveTimeout = 65_000;
  httpServer.headersTimeout = 66_000;
}

main().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
