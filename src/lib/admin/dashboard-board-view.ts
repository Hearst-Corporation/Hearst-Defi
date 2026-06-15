import type { Provenance } from "@/components/ui/provenance-badge";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

export function resolveRiskProvenance(
  hasLiveKpis: boolean,
  risk: RiskFrameworkData,
): Provenance {
  if (!hasLiveKpis) return "manual";
  if (risk.source === "db") return "live";
  if (risk.source === "partial") return "partial";
  return "manual";
}

export function resolveApyProvenance(
  hasLiveKpis: boolean,
  livePreview: boolean,
): Provenance {
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
