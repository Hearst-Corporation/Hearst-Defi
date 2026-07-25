import type { HeroKpi } from "@/lib/data/cockpit";
import { formatRelativeTime } from "./time-formatters";

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
 * Honesty:
 * - "Total signals" sums EVERY status present in the groupBy result — a row
 *   with an unknown/legacy status still counts (it used to be silently
 *   dropped when only the 4 known statuses were summed).
 * - `mostRecentTriggeredAt` must be the most recent signal of the whole vault
 *   scope (the caller queries it independently of the status filter/page).
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
  const executed = countMap["executed"] ?? 0;

  // Sum across ALL statuses present — including unknown/legacy ones.
  const total = Object.values(countMap).reduce<number>(
    (sum, count) => sum + (count ?? 0),
    0,
  );
  if (total === 0) return [];

  const kpis: HeroKpi[] = [
    {
      label: "Total signals",
      value: String(total),
      sublabel: "all statuses, this vault scope",
      provenance: "manual",
    },
    {
      label: "Pending",
      value: String(pending),
      sublabel: "awaiting action",
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
      sublabel: `latest in this vault scope · ${mostRecentTriggeredAt.toISOString().slice(0, 10)}`,
      provenance: "manual",
    });
  }

  return kpis;
}
