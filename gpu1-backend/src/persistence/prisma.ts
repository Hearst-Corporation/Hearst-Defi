// gpu1-backend/src/persistence/prisma.ts
//
// The ONE Prisma client on GPU1. It points at the SAME canonical Supabase prod
// pooler as Connect (via DATABASE_URL from the GPU1 environment) — the DB is not
// duplicated, GPU1 just becomes its only application-level owner.
//
// ROOT CAUSE of the previous /ready 503: Prisma 7 has no built-in query engine —
// the client MUST run against a driver adapter (`@prisma/adapter-pg` for Postgres).
// A bare `new PrismaClient()` has no connection at all. GPU1 reuses Connect's
// exact adapter wiring (`src/lib/db.ts`) so the DB path is single-sourced.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { loadEnv } from "../config/env.js";

let client: PrismaClient | null = null;
let pool: Pool | null = null;

// GPU1 is a long-lived process (not serverless): a modest steady pool, unlike
// Connect's max:1 Vercel Lambda sizing.
const POOL = { max: 8, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 } as const;

export function getPrisma(): PrismaClient {
  if (client) return client;
  const env = loadEnv();
  pool = new Pool({ connectionString: env.DATABASE_URL, ...POOL });
  pool.on("error", (err: Error) => {
    console.error(JSON.stringify({ ts: new Date().toISOString(), scope: "pg.pool", error: err.message }));
  });
  client = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });
  return client;
}

let lastDbOkAt: string | null = null;

/** Cheap liveness probe used by /ready. Returns latency ms, or null on failure. */
export async function pingDb(): Promise<number | null> {
  const started = performance.now();
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    lastDbOkAt = new Date().toISOString();
    return Math.round(performance.now() - started);
  } catch {
    return null;
  }
}

export function lastSuccessfulDbCheck(): string | null {
  return lastDbOkAt;
}
