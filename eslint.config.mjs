import path from "node:path";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/next-env.d.ts",
    "docs/**",
    // The phone app is its own project (own React Native toolchain); checked with its own tsc.
    "apps/mobile/**",
  ]),
  {
    settings: { next: { rootDir: path.join(import.meta.dirname, "apps/school") } },
  },
  {
    // Plain Node CommonJS scripts can't use ES `import`, so `require()` is the
    // only option there — the rule targets app code.
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Architectural guardrail — see CLAUDE.md. Route handlers must go through
    // withAuth + a service/repository, never touch Prisma or JWTs directly.
    files: ["apps/server/src/api/**/route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/prisma",
              message:
                "Route handlers must not import Prisma directly. Call a repository through a service instead. See CLAUDE.md.",
            },
            {
              name: "jsonwebtoken",
              message:
                "Route handlers must not verify JWTs directly. Use withAuth from @/lib/http/with-auth. See CLAUDE.md.",
            },
          ],
        },
      ],
    },
  },
  {
    // The screens never reach the database or server internals directly —
    // everything goes through the API (lib/api-client.ts).
    files: ["apps/school/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@school/server", "@school/server/*"],
              message: "The school app talks to the API over HTTP (lib/api-client.ts), never by importing server code.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
