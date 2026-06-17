import "server-only";

/** Cross-request TTL for admin dashboard read models (silent background refresh). */
export const ADMIN_DASHBOARD_REVALIDATE_SEC = 30;

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
