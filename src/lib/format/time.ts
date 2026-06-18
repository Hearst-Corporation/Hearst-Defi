/**
 * Returns a relative time string like "today", "1 day ago", "3 days ago", "1 month ago".
 * Pure function — no Date.now() inside.
 */
export function relativeTime(date: Date, asOf: Date): string {
  const diffMs = asOf.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}
