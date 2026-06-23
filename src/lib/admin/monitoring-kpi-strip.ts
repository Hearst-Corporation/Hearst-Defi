import type { HeroKpi } from "@/lib/data/cockpit";
import { formatRelativeTimeDate } from "./time-formatters";

interface MonitoringKpiInput {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  complianceBlockedRuns: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  /** Most recent run timestamp, or null if no runs. */
  lastRunAt: Date | null;
}

/**
 * Derives 3–4 honest KPIs from the monitoring stats already loaded by the
 * admin/monitoring page. No DB queries — pure derivation from in-memory data.
 *
 * Returns [] when there are no runs (caller suppresses the strip).
 *
 * Provenance:
 * - Run counts, failure counts, compliance blocks → "manual" (operator DB records)
 * - Error rate (ratio of failures to total) → "estimated" (derived ratio)
 * - Last run recency → "manual"
 */
export function buildMonitoringKpiStrip(
  input: MonitoringKpiInput,
): HeroKpi[] {
  const { totalRuns, failedRuns, complianceBlockedRuns, totalCostUsd, avgLatencyMs, lastRunAt } = input;

  if (totalRuns === 0) return [];

  const healthyRuns = totalRuns - failedRuns - complianceBlockedRuns;
  const healthyPct = Math.round((healthyRuns / totalRuns) * 100);
  const errorRate = Math.round((failedRuns / totalRuns) * 100);

  const kpis: HeroKpi[] = [
    {
      label: "Total runs",
      value: String(totalRuns),
      sublabel: `${healthyRuns} successful`,
      provenance: "manual",
    },
    {
      label: "Healthy",
      value: `${healthyPct}%`,
      sublabel: `${failedRuns} failure${failedRuns === 1 ? "" : "s"} (${errorRate}% error rate)`,
      provenance: "estimated",
      // accent when fully green, alert when error rate meaningful (≥ 10%)
      accent: errorRate === 0,
      alert: errorRate >= 10,
    },
  ];

  if (complianceBlockedRuns > 0) {
    kpis.push({
      label: "Compliance blocks",
      value: String(complianceBlockedRuns),
      sublabel: "cockpit-chat output-guard",
      provenance: "manual",
      alert: false,
    });
  }

  kpis.push({
    label: "Avg latency",
    value: `${avgLatencyMs}ms`,
    sublabel: "per agent run",
    provenance: "estimated",
  });

  if (totalCostUsd > 0) {
    kpis.push({
      label: "Total cost",
      value: `$${totalCostUsd < 1 ? totalCostUsd.toFixed(4) : totalCostUsd.toFixed(2)}`,
      sublabel: lastRunAt
        ? `last run ${formatRelativeTimeDate(lastRunAt)}`
        : "across all runs",
      provenance: "manual",
    });
  } else if (lastRunAt !== null) {
    kpis.push({
      label: "Last run",
      value: formatRelativeTimeDate(lastRunAt),
      sublabel: "most recent agent execution",
      provenance: "manual",
    });
  }

  return kpis;
}
