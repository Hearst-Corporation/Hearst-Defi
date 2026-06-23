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
