/**
 * Single source for Prisma provider selection — must match
 * `scripts/prisma-provider.mjs` (schema swap) and `src/lib/db.ts` (adapter).
 */
export function resolvePrismaProvider(env?: {
  PRISMA_PROVIDER?: string;
  DATABASE_URL?: string;
}): "sqlite" | "postgresql" {
  const source = env ?? {
    PRISMA_PROVIDER: process.env.PRISMA_PROVIDER,
    DATABASE_URL: process.env.DATABASE_URL,
  };
  const explicit = source.PRISMA_PROVIDER?.trim();
  if (explicit === "sqlite" || explicit === "postgresql") {
    return explicit;
  }

  const url = source.DATABASE_URL?.trim() ?? "file:./prisma/dev.db";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }

  return "sqlite";
}
