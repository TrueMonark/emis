import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

// Runs once before the whole test run: brings the TEST database's tables up to date with
// prisma/migrations, so a fresh `_test` database works without a separate step, and a new
// migration is picked up automatically. Only ever touches the database in .env.test.
export default function setup() {
  const serverDir = path.resolve(__dirname, "..");
  const env = config({ path: path.join(serverDir, ".env.test"), processEnv: {} }).parsed ?? {};
  const url = env.DATABASE_URL ?? "";

  if (!url) {
    throw new Error("apps/server/.env.test is missing or has no DATABASE_URL. Copy .env.test.example.");
  }
  if (!url.split("?")[0].endsWith("_test")) {
    throw new Error(
      "DATABASE_URL in .env.test does not look like a test database (expected a name ending in _test). " +
        "Refusing to run — check .env.test."
    );
  }

  const prismaCli = createRequire(path.join(serverDir, "package.json")).resolve("prisma/build/index.js");
  try {
    execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      cwd: serverDir,
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    const output = `${e.stdout?.toString() ?? ""}${e.stderr?.toString() ?? ""}`.trim();
    throw new Error(`Could not prepare the test database (prisma migrate deploy failed):\n${output}`);
  }
}
