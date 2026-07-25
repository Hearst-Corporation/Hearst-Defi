import "server-only";

/** Cross-request TTL for admin dashboard read models (silent background refresh). */
export const ADMIN_DASHBOARD_REVALIDATE_SEC = 30;

/**
 * Loaded<T> — honesty envelope for admin read models (mirror of `Wired<T>` in
 * src/lib/chain/dynavault.ts). A DB read that fails MUST surface as
 * `unavailable`, never as an empty array / zero object: "the read failed" and
 * "the table is empty" are different facts and the UI renders them differently
 * (banner vs empty state). JSON-safe by construction (survives unstable_cache).
 */
export type Loaded<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable"; reason: "db_error"; detail?: string };

/** Build the `unavailable` branch of {@link Loaded} from a caught error. */
export function loadUnavailable<T>(err: unknown): Loaded<T> {
  const detail = err instanceof Error ? err.message : undefined;
  return detail === undefined
    ? { status: "unavailable", reason: "db_error" }
    : { status: "unavailable", reason: "db_error", detail };
}

export function coerceCachedDate(
  value: Date | string | null | undefined,
): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

/**
 * Prisma `Decimal` at the DB boundary, or a plain number/string after
 * `unstable_cache` JSON round-trip. Safe at every loader read boundary.
 */
export function readPrismaDecimal(
  value: { toNumber(): number } | number | string | null | undefined,
  fallback = 0,
): number {
  if (value == null) return fallback;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return fallback;
}
