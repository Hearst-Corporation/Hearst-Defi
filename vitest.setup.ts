/**
 * Vitest setup — runs once before all test files.
 *
 * Ensures critical environment variables are present so that
 * `src/lib/env.ts` validates cleanly in test mode.
 *
 * DATABASE_URL note — Prisma 7 routes the runtime through a driver adapter
 * (`@prisma/adapter-better-sqlite3`) which resolves SQLite paths relative
 * to the process CWD (NOT the schema file, as Prisma 5/6 did). Vitest runs
 * from the project root, so we point explicitly at `prisma/dev.db` to land
 * on the seeded fixture DB instead of creating an empty `./dev.db` orphan.
 *
 * Force sqlite for every test file — a developer `.env.local` may point at
 * Supabase Postgres while the generated client still expects the adapter that
 * matches PRISMA_PROVIDER; without this override, `pnpm test` fails with a
 * driver-adapter mismatch.
 */

process.env.PRISMA_PROVIDER = "sqlite";
process.env.DATABASE_URL = "file:./prisma/dev.db";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "vitest-test-openai-key";
