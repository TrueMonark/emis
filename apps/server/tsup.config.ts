import { defineConfig } from "tsup";

// Production build of the API server → dist/.
//   dist/index.js  starts the server on its own   (npm start)
//   dist/app.js    createApp(), used by the all-in-one /server.js at the repo root
export default defineConfig({
  entry: { index: "src/index.ts", app: "src/app.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: true,
  // The shared package ships TypeScript source, so bundle it in; every other
  // dependency stays in node_modules.
  noExternal: [/^@school\//],
});
