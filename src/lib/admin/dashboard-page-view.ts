import type { AdminOverview } from "@/lib/data/admin-overview";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

/** Strip Yield-only snapshot fields when another fixture vault is in preview scope. */
function vaultScopedDisplayData(
  data: DashboardData,
  risk: RiskFrameworkData,
  preview: boolean,
): DashboardData {
  if (!preview) {
    return { ...data, vault: { ...data.vault, riskScore: risk.composite } };
  }

  return {
    ...data,
    vault: {
      ...data.vault,
      aumUsdc: 0,
      delta30dUsdc: 0,
      apyRange: { low: 0, high: 0 },
      stressedApy: 0,
      stressedApyRange: { low: 0, high: 0 },
      riskScore: 0,
      miningMarginScore: 0,
    },
    allocations: [],
    timeseries: { nav30d: [], apy30d: [], source: "fallback" },
    miningOps: {
      ...data.miningOps,
      hashprice: null,
      is_fallback: true,
    },
  };
}

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

/**
 * Timeline snapshots exist (`daily-seed`, etc.) but are not production-live.
 * KPIs/charts may preview from DB with a simulated badge — never as Live.
 */
export function resolveHasSeedPreview(
  data: DashboardData,
  preview: boolean,
  simulated: boolean,
): boolean {
  return (
    data.hasTimelineSnapshot &&
    !data.hasLiveTimelineSnapshot &&
    !preview &&
    !simulated
  );
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
  const hasSeedPreview = resolveHasSeedPreview(data, preview, simulated);
  // KPIs fill when live, demo-simulated, or seed-preview (badge simulated).
  // hasLiveKpis is kept UNCHANGED so proof-fresh / Attested logic is unaffected.
  const fillKpis = hasLiveKpis || simulated || hasSeedPreview;
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
  // `custodyReservesUsdc === null` = nothing was read. It must not drive the
  // capital figure: an outage would otherwise fall through to the fallback and
  // present it as the custody-backed number.
  const useCustody =
    !preview && custodyConfigured && custodyReservesUsdc !== null && custodyReservesUsdc > 0;
  const capitalUsdc = preview
    ? 0
    : useCustody
      ? custodyReservesUsdc
      : data.vault.aumUsdc;
  // Proof freshness is only meaningful when the dashboard is running on real
  // production data. In seed/staging contexts (hasLiveTimelineSnapshot = false)
  // we suppress proofFresh so that recent-but-mock Proof rows don't trigger
  // an "Attested" badge on the admin dashboard.
  const proofFresh =
    hasLiveKpis &&
    overview.proof.miningFreshness === "live" &&
    overview.proof.attestationsCount > 0;

  return {
    data: vaultScopedDisplayData(data, risk, preview),
    hasLiveKpis,
    hasSeedPreview,
    showVaultAnalytics: hasLiveKpis || hasSeedPreview,
    simulated,
    headlineApy,
    yieldPosture,
    capitalUsdc,
    proofFresh,
    preview,
  };
}
