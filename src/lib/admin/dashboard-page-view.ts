import type { Provenance } from "@/components/ui/provenance-badge";
import type { AdminOverview } from "@/lib/data/admin-overview";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

export function resolveYieldPosture(
  headlineApy: { low: number; high: number } | null,
  apyTarget: { low: number; high: number },
  livePreview: boolean,
): string {
  if (headlineApy === null) {
    return livePreview ? "methodology preset" : "awaiting first snapshot";
  }
  const apyMid = (headlineApy.low + headlineApy.high) / 2;
  if (apyMid < apyTarget.low) return "below target band";
  if (apyMid > apyTarget.high) return "above target band";
  return "within target band";
}

export function resolveHeadlineApy(
  vaultApy: { low: number; high: number },
  apyTarget: { low: number; high: number },
  hasLiveKpis: boolean,
  livePreview: boolean,
): { low: number; high: number } | null {
  if (hasLiveKpis) return vaultApy;
  if (livePreview) return apyTarget;
  return null;
}

export function resolveCapitalProvenance(
  preview: boolean,
  useCustody: boolean,
  custodyProvenance: Provenance,
  hasLiveKpis: boolean,
  aumNumeric: number,
): Provenance {
  if (preview) return "estimated";
  if (useCustody) return custodyProvenance;
  if (hasLiveKpis && aumNumeric > 0) return "live";
  return "manual";
}

export function resolveDashboardPageInputs(
  data: DashboardData,
  risk: RiskFrameworkData,
  overview: AdminOverview,
) {
  const preview = data.vaultMeta.livePreview;
  const hasLiveKpis = data.hasTimelineSnapshot && !preview;
  const headlineApy = resolveHeadlineApy(
    data.vault.apyRange,
    data.vaultMeta.apyTarget,
    hasLiveKpis,
    preview,
  );
  const yieldPosture = resolveYieldPosture(
    headlineApy,
    data.vaultMeta.apyTarget,
    preview,
  );

  const { custodyConfigured, custodyReservesUsdc, custodyProvenance } = overview.proof;
  const useCustody = custodyConfigured && custodyReservesUsdc > 0;
  const capitalUsdc = useCustody ? custodyReservesUsdc : data.vault.aumUsdc;
  const capitalProvenance = resolveCapitalProvenance(
    preview,
    useCustody,
    custodyProvenance,
    hasLiveKpis,
    capitalUsdc,
  );
  const proofFresh =
    overview.proof.miningFreshness === "live" && overview.proof.attestationsCount > 0;

  return {
    data: {
      ...data,
      vault: { ...data.vault, riskScore: risk.composite },
    },
    hasLiveKpis,
    headlineApy,
    yieldPosture,
    capitalUsdc,
    capitalProvenance,
    proofFresh,
    preview,
  };
}
