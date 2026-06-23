/**
 * Time formatters — shared relative-time utilities for admin KPI strips.
 *
 * Pure functions (no I/O, no side-effects). Accept `now` injection for testability.
 */

/**
 * Formats a Date as a human-readable relative time string.
 * Returns compact strings like "just now", "5m ago", "2h ago", "3d ago".
 *
 * @param date - The date to format (assumed to be in the past).
 * @param now  - Injection point for testability (defaults to Date.now()).
 */
export function formatRelativeTime(date: Date, now: number = Date.now()): string {
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1_000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/**
 * Formats a Date as a relative time string using Date objects.
 * Variant for when you already have a Date instance as reference.
 *
 * @param date - The date to format (assumed to be in the past).
 * @param now  - Reference date (defaults to new Date()).
 */
export function formatRelativeTimeDate(date: Date, now: Date = new Date()): string {
  return formatRelativeTime(date, now.getTime());
}
