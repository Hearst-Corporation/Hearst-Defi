/**
 * One-off admin upsert — per-email passwords (the standard seed uses a single
 * ADMIN_INITIAL_PASSWORD, which can't set different passwords per admin).
 *
 * Reads admins from env ADMIN_UPSERT_JSON = [{ "email": "...", "password": "..." }].
 * No secrets live in this file. Provider-aware (pg vs sqlite) like src/lib/db.ts.
 * Idempotent upsert — sets role="admin" + passwordHash. Never resets tables.
 *
 * Run (local sqlite):
 *   DATABASE_URL="file:./prisma/dev.db" PRISMA_PROVIDER=sqlite \
 *   ADMIN_UPSERT_JSON='[...]' tsx prisma/upsert-admins.ts
 * Run (postgres):
 *   DATABASE_URL="postgresql://..." PRISMA_PROVIDER=postgresql \
 *   ADMIN_UPSERT_JSON='[...]' tsx prisma/upsert-admins.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Pool } from "pg";
import { hash } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

function makeAdapter() {
  const url = process.env.DATABASE_URL?.trim() ?? "file:./prisma/dev.db";
  const provider =
    process.env.PRISMA_PROVIDER?.trim() ??
    (url.startsWith("postgres") ? "postgresql" : "sqlite");

  if (provider === "postgresql") {
    return new PrismaPg(new Pool({ connectionString: url, max: 1 }));
  }
  const raw = url.startsWith("file:") ? url.slice("file:".length) : url;
  return new PrismaBetterSqlite3({ url: raw.split("?")[0] });
}

async function main() {
  const spec = JSON.parse(process.env.ADMIN_UPSERT_JSON ?? "[]") as {
    email: string;
    password: string;
  }[];
  if (spec.length === 0) {
    console.log("ADMIN_UPSERT_JSON empty — nothing to do.");
    return;
  }

  const prisma = new PrismaClient({ adapter: makeAdapter() });
  try {
    for (const { email, password } of spec) {
      const normalized = email.trim().toLowerCase();
      const passwordHash = await hash(password, ARGON2_OPTIONS);
      await prisma.user.upsert({
        where: { email: normalized },
        update: { role: "admin", passwordHash },
        create: { email: normalized, role: "admin", passwordHash },
      });
      console.log(`✓ admin upserted: ${normalized} (role=admin, password set)`);
    }
    console.log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("upsert-admins failed:", e);
  process.exit(1);
});
