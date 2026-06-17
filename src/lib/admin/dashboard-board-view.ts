import type { Provenance } from "@/components/ui/provenance-badge";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { ActionQueueItem } from "@/lib/data/cockpit";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

/** Operator-queue headline — same length as the ActionQueue panel below. */
export function resolveOperatorQueueCount(actionQueue: ActionQueueItem[]): number {
  return actionQueue.length;
}

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

/** Allocation orbit — same honesty gate as the KPI strip (`hasLiveKpis`). */
export function resolveAllocationProvenance(
  simulated: boolean | undefined,
  allocationLive: boolean,
): Provenance {
  if (simulated) return "simulated";
  if (allocationLive) return "live";
  return "manual";
}

/** NAV slot — mirrors allocation (no `estimated` for empty/staging series). */
export function resolveNavProvenance(
  simulated: boolean | undefined,
  navLive: boolean,
): Provenance {
  if (simulated) return "simulated";
  if (navLive) return "live";
  return "manual";
}

export function resolveApyProvenance(
  hasLiveKpis: boolean,
  livePreview: boolean,
  simulated?: boolean,
): Provenance {
  if (simulated) return "simulated";
  if (hasLiveKpis) return "live";
  if (livePreview) return "estimated";
  return "manual";
}

/** Mining margin — mirrors APY gates (`livePreview` → estimated methodology preset). */
export function resolveMiningProvenance(
  hasLiveKpis: boolean,
  livePreview: boolean,
  simulated?: boolean,
): Provenance {
  if (simulated) return "simulated";
  if (hasLiveKpis) return "live";
  if (livePreview) return "estimated";
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

export function computeNavDelta(
  lastNav: number | null,
  firstNav: number | null,
): number | null {
  if (lastNav === null || firstNav === null || firstNav === 0) return null;
  return ((lastNav - firstNav) / firstNav) * 100;
}
