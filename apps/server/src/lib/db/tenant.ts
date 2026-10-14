import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";

/**
 * Keeping schools apart (Phase 3a).
 *
 * Every query the app makes runs inside a database transaction that first:
 *   - switches to the role `emis_app`, which row-level security applies to, and
 *   - sets `app.school_id` (and `app.user_id`) for that transaction only.
 * The database then shows only the current school's rows, and new rows get that school's id
 * automatically (column default). A query that forgets a `where schoolId` filter still can't
 * see another school's data.
 *
 * The school comes from the request: `withAuth` looks up the person's ACTIVE membership and
 * runs the handler inside `runWithTenant({ schoolId, userId }, ...)`. Outside a request there is
 * no school, so school-owned tables look empty and inserts into them fail. Scripts that must
 * work across schools (seed, tests' table reset) use `systemPrisma` from `./prisma`, which is
 * not restricted, and must say which school they mean.
 *
 * Mechanism: every top-level call (`prisma.student.findMany(...)`) is delayed until awaited and
 * then run as `$transaction([setContext, query])`. `prisma.$transaction([...])` runs all its
 * queries after one setContext; `prisma.$transaction(async (tx) => ...)` sets the context at
 * the start of the interactive transaction, so everything done with `tx` is scoped too.
 */

export interface TenantContext {
  /** The school whose rows are visible; null = none (school-owned tables look empty). */
  schoolId: string | null;
  /** The signed-in person; lets them see their own teacher profile from any school. */
  userId: string | null;
}

const storage = new AsyncLocalStorage<TenantContext>();
let testFallback: TenantContext | null = null;

/** Run `fn` with the given school/user as the database context. */
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentTenant(): TenantContext {
  return storage.getStore() ?? testFallback ?? { schoolId: null, userId: null };
}

/** The current request's school. Throws if there is none (a bug: the code ran outside withAuth). */
export function requireSchoolId(): string {
  const { schoolId } = currentTenant();
  if (!schoolId) {
    throw new Error("No school in the current context (code ran outside a school request)");
  }
  return schoolId;
}

/**
 * Tests only: the context used when no request is running, so fixtures can create rows in the
 * test school. Refuses to work outside Vitest.
 */
export function setTestFallbackTenant(context: TenantContext | null): void {
  if (!process.env.VITEST) {
    throw new Error("setTestFallbackTenant is only for tests");
  }
  testFallback = context;
}

// ---------------------------------------------------------------------------------------------

type AnyClient = PrismaClient & Record<string, unknown>;

const RAW_METHODS = new Set(["$queryRaw", "$executeRaw", "$queryRawUnsafe", "$executeRawUnsafe"]);
const DEFERRED = Symbol("tenantDeferred");

/** A query that hasn't run yet: runs (once) when awaited, or inside a batch $transaction. */
class DeferredQuery<T = unknown> implements PromiseLike<T> {
  readonly [DEFERRED] = true;
  private promise: Promise<T> | null = null;
  /** The school/user when the query was written, not when it's awaited (they can differ). */
  private readonly context: TenantContext = currentTenant();

  constructor(
    private readonly base: AnyClient,
    private readonly model: string | null,
    private readonly method: string,
    private readonly args: unknown[]
  ) {}

  /** The real Prisma call on `client` (lazy until awaited / batched). */
  build(client: AnyClient): unknown {
    const target = (this.model ? client[this.model] : client) as Record<string, (...a: unknown[]) => unknown>;
    return target[this.method](...this.args);
  }

  private run(): Promise<T> {
    if (!this.promise) {
      this.promise = (
        this.base.$transaction([contextStatement(this.base, this.context), this.build(this.base)] as never) as Promise<unknown[]>
      ).then((results) => results[1] as T);
    }
    return this.promise;
  }

  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return this.run().then(onFulfilled, onRejected);
  }

  catch<R = never>(onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<T | R> {
    return this.run().catch(onRejected);
  }

  finally(onFinally?: (() => void) | null): Promise<T> {
    return this.run().finally(onFinally);
  }

  get [Symbol.toStringTag]() {
    return "PrismaPromise";
  }
}

function isDeferred(value: unknown): value is DeferredQuery {
  return typeof value === "object" && value !== null && DEFERRED in value;
}

/** `SET LOCAL ROLE emis_app` + this transaction's school and user. */
function contextStatement(client: AnyClient, context: TenantContext = currentTenant()): unknown {
  const { schoolId, userId } = context;
  return client.$executeRaw`SELECT set_config('role', 'emis_app', true),
    set_config('app.school_id', ${schoolId ?? ""}, true),
    set_config('app.user_id', ${userId ?? ""}, true)`;
}

/**
 * Wrap a Prisma client so every query runs in the current school's context. The result has the
 * same type and API as PrismaClient.
 */
export function createTenantClient<C extends PrismaClient>(baseClient: C): C {
  const base = baseClient as unknown as AnyClient;
  const delegates = new Map<string, unknown>();

  const transaction = (arg: unknown, options?: unknown) => {
    if (typeof arg === "function") {
      return base.$transaction(async (tx: unknown) => {
        await (contextStatement(tx as AnyClient) as Promise<unknown>);
        return (arg as (tx: unknown) => unknown)(tx);
      }, options as never);
    }
    if (Array.isArray(arg)) {
      const queries = arg.map((item) => (isDeferred(item) ? item.build(base) : item));
      return (base.$transaction([contextStatement(base), ...queries] as never, options as never) as Promise<unknown[]>).then(
        (results) => results.slice(1)
      );
    }
    throw new TypeError("$transaction expects a function or an array of queries");
  };

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === "$transaction") return transaction;
      if (typeof prop === "string" && RAW_METHODS.has(prop)) {
        return (...args: unknown[]) => new DeferredQuery(base, null, prop, args);
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || prop.startsWith("$") || prop.startsWith("_")) {
        return typeof value === "function" ? value.bind(target) : value;
      }
      // A model delegate (prisma.student, prisma.subject …)
      if (value && typeof value === "object") {
        let wrapped = delegates.get(prop);
        if (!wrapped) {
          const delegate = value as Record<string, unknown>;
          wrapped = new Proxy(delegate, {
            get(d, method) {
              const member = Reflect.get(d, method);
              if (typeof method === "string" && typeof member === "function") {
                return (...args: unknown[]) => new DeferredQuery(base, prop, method, args);
              }
              return member;
            },
          });
          delegates.set(prop, wrapped);
        }
        return wrapped;
      }
      return value;
    },
  }) as unknown as C;
}
