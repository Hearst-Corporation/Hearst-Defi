import type { HeroKpi } from "@/lib/data/cockpit";

interface SignalsCountMap {
  pending?: number;
  approved?: number;
  executed?: number;
  cancelled?: number;
  [key: string]: number | undefined;
}

/**
 * Derives 3–4 honest KPIs from the signals (RebalanceEvent) data already
 * loaded by the admin/signals page. No DB queries — pure derivation.
 *
 * Returns [] when there are no signals at all (caller suppresses the strip).
 *
 * Provenance:
 * - All cells → "manual" (operator-confirmed DB records created by Inngest or
 *   manual trigger; no oracle, no estimation).
 */
export function buildSignalsKpiStrip(
  countMap: SignalsCountMap,
  mostRecentTriggeredAt: Date | null,
): HeroKpi[] {
  const pending = countMap["pending"] ?? 0;
  const approved = countMap["approved"] ?? 0;
  const executed = countMap["executed"] ?? 0;
  const cancelled = countMap["cancelled"] ?? 0;

  const total = pending + approved + executed + cancelled;
  if (total === 0) return [];

  const kpis: HeroKpi[] = [
    {
      label: "Total signals",
      value: String(total),
      sublabel: "all statuses, this vault",
      provenance: "manual",
    },
    {
      label: "Pending",
      value: String(pending),
      sublabel: pending === 1 ? "awaiting action" : "awaiting action",
      provenance: "manual",
      alert: pending > 0,
      accent: pending === 0,
    },
    {
      label: "Executed",
      value: String(executed),
      sublabel: `of ${total} total`,
      provenance: "manual",
      accent: executed > 0,
    },
  ];

  if (mostRecentTriggeredAt !== null) {
    kpis.push({
      label: "Most recent",
      value: formatRelativeTime(mostRecentTriggeredAt),
      sublabel: mostRecentTriggeredAt.toISOString().slice(0, 10),
      provenance: "manual",
    });
  }

  return kpis;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a Date as a human-readable relative time string.
 * Pure function — no external deps, no I/O.
 *
 * @param date - The date to format (assumed to be in the past).
 * @param now  - Injection point for testability (defaults to Date.now()).
 */
export function formatRelativeTime(date: Date, now = Date.now()): string {
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1_000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
