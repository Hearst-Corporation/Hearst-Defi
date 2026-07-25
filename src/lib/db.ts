import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Pool } from "pg";

import { env } from "@/lib/env";
import { resolvePrismaProvider } from "@/lib/prisma-provider-resolve";

/**
 * Prisma 7 + Next.js dev singleton.
 *
 * Prisma 7 no longer ships a native query engine per platform — the client
 * runs against a **driver adapter** (`@prisma/adapter-better-sqlite3` for
 * local dev / `@prisma/adapter-pg` on Vercel). The provider is env-driven
 * (`PRISMA_PROVIDER`) and mirrors `prisma.config.ts`, so the CLI and the
 * runtime stay in lockstep.
 *
 * Both adapter packages (and their native deps `better-sqlite3` / `pg`) are
 * listed in `next.config.ts#serverExternalPackages`, so importing both
 * statically here is free at bundle-time — only the branch actually used at
 * runtime instantiates a native driver.
 *
 * In development, Next.js HMR re-evaluates this module on every change,
 * which would otherwise spawn a new PrismaClient (and a new connection
 * pool) on each reload until the DB runs out of connections. We stash
 * the client on `globalThis` so it survives HMR. The `as unknown as`
 * cast is required because `globalThis` is typed as the global scope and
 * has no `prisma` member — there is no safer way to augment it inline.
 *
 * On Vercel serverless (PostgreSQL), the Pool is also memoised: without it,
 * each cold invocation would open a new pg connection and quickly saturate
 * Supabase's ~60-connection pool limit. `max: 1` + `idleTimeoutMillis` keeps
 * the footprint serverless-safe while still reusing the connection across
 * multiple requests within the same Lambda execution context.
 *
 * Local dev uses a wider pool: admin dashboard fans out ~20 parallel Prisma
 * queries (Promise.all on loaders). `max: 1` against Supabase pooler causes
 * `connectionTimeout` burst failures.
 */

function pgPoolSizing(): {
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
} {
  const isVercel = Boolean(env.VERCEL);
  const isDev = process.env.NODE_ENV === "development";
  if (isVercel) {
    return { max: 1, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000 };
  }
  if (isDev) {
    return { max: 8, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 10_000 };
  }
  return { max: 4, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 };
}

const globalForDb = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function makeAdapter() {
  const provider = resolvePrismaProvider();
  // `env.DATABASE_URL` is required (min(1)) outside test mode; in the vitest
  // lenient fallback an ABSENT var degrades to "" — `||` restores the same
  // sqlite default the old `?? ` fallback produced for an absent var.
  const databaseUrl = env.DATABASE_URL.trim() || "file:./prisma/dev.db";

  if (provider === "postgresql") {
    const poolSizing = pgPoolSizing();
    const pool =
      globalForDb.pgPool ??
      new Pool({
        connectionString: databaseUrl,
        ...poolSizing,
      });
    if (!globalForDb.pgPool) {
      globalForDb.pgPool = pool;
      pool.on("error", (err: Error) => {
        // pg removes the dead client from the pool automatically;
        // we just log to avoid crashing the Lambda with an unhandled 'error' event.
        console.error("[pg.pool] idle client error:", err.message);
      });
    }
    return new PrismaPg(pool);
  }

  // SQLite — strip the `file:` prefix; better-sqlite3 expects a plain path.
  // Also strip any query params (e.g. ?cache=shared&mode=rwc) that are valid
  // in libsql URLs but not accepted by better-sqlite3.
  const rawUrl = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;
  const url = rawUrl.split("?")[0];
  return new PrismaBetterSqlite3({ url });
}

export const prisma =
  globalForDb.prisma ??
  new PrismaClient({
    adapter: makeAdapter(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Memoise on globalThis in all environments — including production.
// Without this, every serverless invocation allocates a fresh PrismaClient
// and a fresh pg connection, which saturates the Supabase pool under load.
globalForDb.prisma = prisma;
