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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { resolvePrismaProvider } from "../../src/lib/prisma-provider-resolve-core";

/** Match the generated client provider (schema file), not env inference alone. */
function readSchemaProvider(): "sqlite" | "postgresql" | null {
  try {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const match = /datasource\s+\w+\s*\{[^}]*?\n\s*provider\s*=\s*"(\w+)"/s.exec(schema);
    const provider = match?.[1];
    if (provider === "sqlite" || provider === "postgresql") return provider;
  } catch {
    // fall through to env inference
  }
  return null;
}

export function makePrismaClient(): PrismaClient {
  // PRISMA_PROVIDER explicite > schema provider > DATABASE_URL inference
  const provider =
    process.env.PRISMA_PROVIDER?.trim() === "sqlite" ||
    process.env.PRISMA_PROVIDER?.trim() === "postgresql"
      ? (process.env.PRISMA_PROVIDER.trim() as "sqlite" | "postgresql")
      : (readSchemaProvider() ?? resolvePrismaProvider());
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
