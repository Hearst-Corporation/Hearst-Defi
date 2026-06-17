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
