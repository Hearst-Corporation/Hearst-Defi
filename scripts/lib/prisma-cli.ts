/**
 * Tiny helper shared by every CLI script that needs a PrismaClient outside
 * the Next.js server runtime (seed.ts, prisma/backfill.ts,
 * scripts/seed-vaults-prod.ts, …).
 *
 * Prisma 7 requires the client to be constructed with a driver adapter — we
 * cannot just `new PrismaClient()` like in Prisma 6. The provider is selected
 * from `PRISMA_PROVIDER` (default sqlite, mirrors src/lib/db.ts and
 * prisma.config.ts) and the connection string from `DATABASE_URL` (default
 * `file:./prisma/dev.db` for local dev).
 *
 * These scripts run under `tsx` and never touch the Next server runtime, so
 * `server-only` is intentionally NOT imported here.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

export function makePrismaClient(): PrismaClient {
  const provider = process.env.PRISMA_PROVIDER?.trim() ?? "sqlite";
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ?? "file:./prisma/dev.db";

  if (provider === "postgresql") {
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
  }

  const url = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  });
}
