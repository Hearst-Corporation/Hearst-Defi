import type { HeroKpi } from "@/lib/data/cockpit";
import { formatRelativeTimeDate } from "./time-formatters";

interface MonitoringKpiInput {
  totalRuns: number;
  /** Runs with status "success" (the REAL DB count — includes cockpit-chat
   *  turns whose output was compliance-blocked, which finish "success"). */
  successfulRuns: number;
  /** Runs with status "failed" or "timeout". */
  failedRuns: number;
  complianceBlockedRuns: number;
  totalCostUsd: number;
  /** `null` = no run has recorded a latency yet (empty base). */
  avgLatencyMs: number | null;
  /** Most recent run timestamp, or null if no runs. */
  lastRunAt: Date | null;
}

/**
 * Derives 3–5 honest KPIs from the monitoring stats already loaded by the
 * admin/monitoring page. No DB queries — pure derivation from in-memory data.
 *
 * Returns [] when there are no runs (caller suppresses the strip).
 *
 * Honesty:
 * - "N successful" is the REAL `status = success` count from the DB — it no
 *   longer counts pending/queued runs as successes; those are stated
 *   separately in the sublabel.
 * - "Healthy" % is successfulRuns / totalRuns for the same reason.
 * - Avg latency on an empty base is "—", never "0ms".
 *
 * Provenance:
 * - Run counts, failure counts, compliance blocks → "manual" (operator DB records)
 * - Ratios (healthy %, error rate) and mean latency → "estimated" (derived)
 * - Last run recency → "manual"
 */
export function buildMonitoringKpiStrip(
  input: MonitoringKpiInput,
): HeroKpi[] {
  const {
    totalRuns,
    successfulRuns,
    failedRuns,
    complianceBlockedRuns,
    totalCostUsd,
    avgLatencyMs,
    lastRunAt,
  } = input;

  if (totalRuns === 0) return [];

  // Runs that are neither success nor failed/timeout: pending, queued, or any
  // unknown status. Said separately — never silently folded into "successful".
  const otherRuns = Math.max(0, totalRuns - successfulRuns - failedRuns);
  const healthyPct = Math.round((successfulRuns / totalRuns) * 100);
  const errorRate = Math.round((failedRuns / totalRuns) * 100);

  const kpis: HeroKpi[] = [
    {
      label: "Total runs",
      value: String(totalRuns),
      sublabel:
        otherRuns > 0
          ? `${successfulRuns} successful · ${otherRuns} pending/other`
          : `${successfulRuns} successful`,
      provenance: "manual",
    },
    {
      label: "Healthy",
      value: `${healthyPct}%`,
      sublabel: `${failedRuns} failure${failedRuns === 1 ? "" : "s"} (${errorRate}% error rate)`,
      provenance: "estimated",
      // accent only when every run succeeded; alert when error rate ≥ 10%
      // (operational threshold — hand-tuned, no external source).
      accent: errorRate === 0 && healthyPct === 100,
      alert: errorRate >= 10,
    },
  ];

  if (complianceBlockedRuns > 0) {
    kpis.push({
      label: "Compliance blocks",
      value: String(complianceBlockedRuns),
      // Scope stated: this counter covers cockpit-chat only, not every agent.
      sublabel: "cockpit-chat output-guard only",
      provenance: "manual",
      alert: false,
    });
  }

  kpis.push(
    avgLatencyMs === null
      ? {
          label: "Avg latency",
          value: "—",
          sublabel: "no latency recorded yet",
          provenance: "estimated",
        }
      : {
          label: "Avg latency",
          value: `${avgLatencyMs}ms`,
          sublabel: "per agent run",
          provenance: "estimated",
        },
  );

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
