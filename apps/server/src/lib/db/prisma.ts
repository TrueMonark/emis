import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createTenantClient } from "./tenant";

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new pg.Pool({
    connectionString,
    // Allow enough concurrent DB connections for heavy classroom usage.
    // Keep below your database server's max_connections limit.
    // Render free-tier PostgreSQL cap is 25; paid tiers support 100+.
    max: parseInt(process.env.DB_POOL_MAX ?? "25"),
    // Release idle connections after 30 s to keep the pool lean when quiet.
    idleTimeoutMillis: 30_000,
    // Fail a request quickly (10 s) instead of queuing forever when every
    // connection is busy — lets the API return a 503 rather than hanging.
    connectionTimeoutMillis: 10_000,
    // Allow the pool to be GC'd when the process is idle.
    allowExitOnIdle: true,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const baseClient = globalThis.prismaGlobal ?? prismaClientSingleton();
if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = baseClient;

/**
 * The client the whole app uses. Every query runs in the current request's school (row-level
 * security, see ./tenant.ts), so a school only ever sees its own rows.
 */
const prisma = createTenantClient(baseClient);
export default prisma;

/**
 * NOT restricted to a school. Only for the seed, test table resets and maintenance scripts —
 * never in src/features or src/api. Anything written with it must set schoolId itself.
 */
export const systemPrisma = baseClient;
