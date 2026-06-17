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
  fillKpis: boolean,
  livePreview: boolean,
): { low: number; high: number } | null {
  if (fillKpis) return vaultApy;
  if (livePreview) return apyTarget;
  return null;
}

export function resolveDashboardPageInputs(
  data: DashboardData,
  risk: RiskFrameworkData,
  overview: AdminOverview,
) {
  const preview = data.vaultMeta.livePreview;
  // `simulated` = demo builder payload: KPIs fill but provenance stays honest.
  const simulated = data.simulated === true;
  // Gate on `hasLiveTimelineSnapshot`, not the weaker `hasTimelineSnapshot`.
  // A `daily-seed` row sets `hasTimelineSnapshot = true` but must never
  // activate Live/Attested provenance badges on the admin dashboard.
  const hasLiveKpis = data.hasLiveTimelineSnapshot && !preview;
  // KPIs fill when we have genuine live data OR when we are in simulated mode.
  // hasLiveKpis is kept UNCHANGED so proof-fresh / Attested logic is unaffected.
  const fillKpis = hasLiveKpis || simulated;
  const headlineApy = resolveHeadlineApy(
    data.vault.apyRange,
    data.vaultMeta.apyTarget,
    fillKpis,
    preview,
  );
  const yieldPosture = resolveYieldPosture(
    headlineApy,
    data.vaultMeta.apyTarget,
    preview,
  );

  const { custodyConfigured, custodyReservesUsdc } = overview.proof;
  const useCustody = custodyConfigured && custodyReservesUsdc > 0;
  const capitalUsdc = useCustody ? custodyReservesUsdc : data.vault.aumUsdc;
  // Proof freshness is only meaningful when the dashboard is running on real
  // production data. In seed/staging contexts (hasLiveTimelineSnapshot = false)
  // we suppress proofFresh so that recent-but-mock Proof rows don't trigger
  // an "Attested" badge on the admin dashboard.
  const proofFresh =
    hasLiveKpis &&
    overview.proof.miningFreshness === "live" &&
    overview.proof.attestationsCount > 0;

  return {
    data: {
      ...data,
      vault: { ...data.vault, riskScore: risk.composite },
    },
    hasLiveKpis,
    simulated,
    headlineApy,
    yieldPosture,
    capitalUsdc,
    proofFresh,
    preview,
  };
}
