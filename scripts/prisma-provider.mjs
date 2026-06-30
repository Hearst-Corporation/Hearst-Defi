/**
 * scripts/prisma-provider.mjs
 *
 * WHY THIS EXISTS:
 * Prisma 6/7 does NOT support env() inside the `datasource.provider` field.
 * This means we cannot switch the provider between sqlite (local dev) and
 * postgresql (CI / Vercel prod) via a plain env var in schema.prisma. As of
 * Prisma 7, `url` itself is no longer allowed in `datasource` — the runtime
 * connection is made through a driver adapter in src/lib/db.ts, and the CLI
 * reads its connection from prisma.config.ts (also env-driven). All that
 * remains schema-side is the static `provider` line, which this script flips.
 *
 * This script runs BEFORE `prisma generate` in the build pipeline. It reads
 * PRISMA_PROVIDER and rewrites ONLY the `provider = "..."` line inside the
 * `datasource db { ... }` block — leaving everything else (generator block,
 * binaryTargets, models) completely untouched.
 *
 * USAGE:
 *   node scripts/prisma-provider.mjs               # PRISMA_PROVIDER absent → no-op
 *   PRISMA_PROVIDER=postgresql node …              # flips datasource provider to postgresql
 *   PRISMA_PROVIDER=sqlite     node …              # flips datasource provider to sqlite
 *
 * EXIT: always 0 (non-IO errors aside).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./lib/load-env.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA_PATH = resolve(__dirname, "../prisma/schema.prisma");

const ALLOWED = new Set(["sqlite", "postgresql"]);

loadProjectEnv(resolve(__dirname, ".."));

function resolvePrismaProvider() {
  const explicit = process.env.PRISMA_PROVIDER?.trim();
  if (explicit === "sqlite" || explicit === "postgresql") return explicit;
  const url = process.env.DATABASE_URL?.trim() ?? "file:./prisma/dev.db";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }
  return "sqlite";
}

let target = resolvePrismaProvider();

if (!ALLOWED.has(target)) {
  console.error(
    `[prisma-provider] ERROR: PRISMA_PROVIDER="${target}" is not a recognised value. ` +
      `Accepted values: ${[...ALLOWED].join(", ")}.`
  );
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// HARD DATABASE LOCK — PRISMA_PROVIDER_LOCK
// When set (e.g. PRISMA_PROVIDER_LOCK=postgresql in .env.local), the provider is
// PINNED to that value: any attempt to switch away from it (notably the test
// pipeline forcing sqlite) is REFUSED, and the locked provider is kept. This
// stops a stray/crashed `pretest` or a rogue agent from leaving the schema on
// sqlite and breaking the live postgres dev server. To run sqlite-isolated
// tests, use the dedicated PRISMA_SQLITE_ISOLATED=1 path (own client dir), which
// never rewrites the shared schema.
const lock = process.env.PRISMA_PROVIDER_LOCK?.trim();
if (lock) {
  if (!ALLOWED.has(lock)) {
    console.error(
      `[prisma-provider] ERROR: PRISMA_PROVIDER_LOCK="${lock}" is not a recognised value. ` +
        `Accepted values: ${[...ALLOWED].join(", ")}.`
    );
    process.exit(1);
  }
  // The isolated-sqlite test path is allowed to bypass the lock — it never
  // touches the shared schema/client (it uses its own generated client dir).
  const isolated = process.env.PRISMA_SQLITE_ISOLATED === "1";
  if (target !== lock && !isolated) {
    console.error(
      `[prisma-provider] LOCKED: provider is pinned to "${lock}" by PRISMA_PROVIDER_LOCK; ` +
        `refusing to switch to "${target}". Keeping "${lock}".`
    );
    target = lock;
  }
}

let schema;
try {
  schema = readFileSync(SCHEMA_PATH, "utf8");
} catch (err) {
  console.error(`[prisma-provider] ERROR: cannot read ${SCHEMA_PATH}: ${err.message}`);
  process.exit(1);
}

// Detect current provider inside the datasource block only.
// Pattern matches:  provider = "sqlite"  or  provider = "postgresql"
// anchored to the datasource block by requiring it to follow `datasource db {`
// via a stateful scan — but since the schema has exactly one datasource, a
// targeted regex on the datasource section is sufficient and avoids false
// positives on generator.provider or model fields.
const DATASOURCE_RE = /(datasource\s+\w+\s*\{[^}]*?\n\s*provider\s*=\s*")(\w+)(")/s;

const match = DATASOURCE_RE.exec(schema);
if (!match) {
  console.error(
    "[prisma-provider] ERROR: could not locate `provider = \"...\"` inside a datasource block. " +
      "Schema format may have changed."
  );
  process.exit(1);
}

const current = match[2];

if (current === target) {
  console.log(`[prisma-provider] provider is already "${target}" — no-op`);
  process.exit(0);
}

const updated = schema.replace(DATASOURCE_RE, `$1${target}$3`);

try {
  writeFileSync(SCHEMA_PATH, updated, "utf8");
} catch (err) {
  console.error(`[prisma-provider] ERROR: cannot write ${SCHEMA_PATH}: ${err.message}`);
  process.exit(1);
}

console.log(`[prisma-provider] switched provider from "${current}" to "${target}"`);
