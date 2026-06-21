import type { HeroKpi } from "@/lib/data/cockpit";

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
        ? `last run ${formatRelative(lastRunAt)}`
        : "across all runs",
      provenance: "manual",
    });
  } else if (lastRunAt !== null) {
    kpis.push({
      label: "Last run",
      value: formatRelative(lastRunAt),
      sublabel: "most recent agent execution",
      provenance: "manual",
    });
  }

  return kpis;
}

/** Compact relative time label (no external dep, no I/O). */
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}
