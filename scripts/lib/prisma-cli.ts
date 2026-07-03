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

/**
 * Production Supabase project ref (host `db.<ref>.supabase.co` / pooler
 * `postgres.<ref>@…pooler.supabase.com`). Any DATABASE_URL pointing here is the
 * live production database (`connect.hearst.app`).
 */
const PROD_DB_REF = "xrwzxhsenwmlxbwqcftz";

/**
 * Fail-closed prod guard. A CLI seed/wipe script must NEVER touch the production
 * DB by accident — the `NODE_ENV === "production"` check inside individual
 * scripts is not enough, because these scripts are run locally (NODE_ENV unset)
 * with a `.env.local` whose DATABASE_URL points at prod. That is exactly how the
 * dev fixture ($500k position + dev_seed VaultSnapshot) leaked into production.
 *
 * So we gate on the *connection target*, not the environment: if DATABASE_URL
 * resolves to the prod Supabase ref, refuse to build a client unless the caller
 * has explicitly opted in with `ALLOW_PROD_WRITES=1`. Legitimately prod-facing
 * scripts (e.g. seed-vaults-prod) set that flag on purpose.
 */
function assertNotProdUnlessAllowed(databaseUrl: string): void {
  const targetsProd = databaseUrl.includes(PROD_DB_REF);
  if (!targetsProd) return;

  const allowed = process.env.ALLOW_PROD_WRITES?.trim() === "1";
  if (allowed) {
    console.warn(
      "⚠️  prisma-cli: DATABASE_URL targets PRODUCTION — proceeding because ALLOW_PROD_WRITES=1.",
    );
    return;
  }

  throw new Error(
    [
      "REFUSING to connect: DATABASE_URL points at the PRODUCTION database",
      `(Supabase ref ${PROD_DB_REF} / connect.hearst.app).`,
      "",
      "CLI seed/wipe scripts must not write to prod by accident. If you truly",
      "intend a production operation, re-run with ALLOW_PROD_WRITES=1 prefixed:",
      "  ALLOW_PROD_WRITES=1 pnpm tsx scripts/<script>.ts",
      "",
      "For a local dev DB, unset the prod DATABASE_URL (defaults to SQLite",
      "file:./prisma/dev.db) or point it at your local Postgres.",
    ].join("\n"),
  );
}

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

  // Fail-closed: never let a CLI script write to prod unless explicitly allowed.
  assertNotProdUnlessAllowed(databaseUrl);

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
