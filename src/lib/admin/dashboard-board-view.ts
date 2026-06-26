import type { Provenance } from "@/components/ui/provenance-badge";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

export function resolveRiskProvenance(
  hasLiveKpis: boolean,
  risk: RiskFrameworkData,
  simulated?: boolean,
): Provenance {
  if (simulated) return "simulated";
  if (!hasLiveKpis) return "manual";
  if (risk.source === "db") return "live";
  if (risk.source === "partial") return "partial";
  return "manual";
}

/** APY + Mining KPI strip — seed preview and demo read simulated, not live. */
export function resolveVaultSignalProvenance(
  hasLiveKpis: boolean,
  livePreview: boolean,
  simulated?: boolean,
  hasSeedPreview?: boolean,
): Provenance {
  if (simulated || hasSeedPreview) return "simulated";
  if (hasLiveKpis) return "live";
  if (livePreview) return "estimated";
  return "manual";
}

/** Allocation orbit + NAV chart — seed preview uses simulated provenance. */
export function resolveChartProvenance(
  simulated: boolean | undefined,
  chartLive: boolean,
  hasSeedPreview?: boolean,
): Provenance {
  if (simulated || hasSeedPreview) return "simulated";
  if (chartLive) return "live";
  return "manual";
}

export function resolveProofProvenance(
  proofFresh: boolean,
  proof: AdminProofStatus,
): Provenance {
  if (proofFresh) return "attested";
  if (proof.attestationsCount > 0) return "stale";
  return "manual";
}

/**
 * Operator queue KPI — count is always from `cockpit.actionQueue` (platform-wide,
 * Prisma-derived when not demo). Never badge as vault-scoped `live`: the queue is
 * not filtered by the active vault pill.
 */
export function resolveOperatorQueueProvenance(
  count: number,
  simulated?: boolean,
  _hasLiveKpis = false,
  livePreview = false,
): Provenance {
  if (simulated) return "simulated";
  if (count === 0) return "manual";
  if (livePreview) return "manual";
  // Platform-wide queue — not vault-scoped (`hasLiveKpis` gates other KPIs only).
  return "partial";
}

export function computeNavDelta(
  lastNav: number | null,
  firstNav: number | null,
): number | null {
  if (lastNav === null || firstNav === null || firstNav === 0) return null;
  return ((lastNav - firstNav) / firstNav) * 100;
}
