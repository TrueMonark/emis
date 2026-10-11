import path from "node:path";
import type { NextConfig } from "next";

// Where the API server (apps/server) is listening. Used when the school app
// runs as its own process (development, or split hosting): every /api and
// /uploads request is passed through to the server, so the browser only ever
// talks to this app's own address and no screen code needed to change.
//
// In the all-in-one production mode (/server.js) the API answers /api and
// /uploads itself, before a request ever reaches this app, so these rewrites
// are simply never used there.
//
// Read at build time: set API_URL before `next build` if it isn't the default.
const apiUrl = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // The shared packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@school/shared", "@school/ui"],
  // This app lives inside a monorepo; the repo root holds node_modules.
  turbopack: { root: path.join(__dirname, "../..") },
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    // Some API calls (timetable generation, bulk PDF exports) take longer
    // than the 30s default the pass-through allows.
    proxyTimeout: 120_000,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      { source: "/uploads/:path*", destination: `${apiUrl}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
