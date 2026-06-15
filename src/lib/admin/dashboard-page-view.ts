import type { Provenance } from "@/components/ui/provenance-badge";
import type { AdminOverview } from "@/lib/data/admin-overview";
import type { CockpitPayload } from "@/lib/data/cockpit";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

export type DashboardDataNotice =
  | { kind: "preview"; vaultName: string; assumptions: string[] }
  | { kind: "staging"; snapshotSource: string }
  | { kind: "mixed-platform"; vaultName: string; assumptions: string[] };

function hasPlatformWideSignals(
  data: DashboardData,
  overview: AdminOverview,
  cockpit: CockpitPayload,
): boolean {
  return (
    overview.proof.attestationsCount > 0 ||
    overview.proof.proofsTotal > 0 ||
    data.latestDistribution !== null ||
    cockpit.actionQueue.length > 0 ||
    overview.totalActionRequired > 0 ||
    cockpit.auditTrail.length > 0
  );
}

/** Page-level honesty banner — shown above the command board when data planes diverge. */
export function resolveDashboardDataNotice(
  data: DashboardData,
  overview: AdminOverview,
  cockpit: CockpitPayload,
  hasLiveKpis: boolean,
  preview: boolean,
): DashboardDataNotice | null {
  if (preview) {
    return {
      kind: "preview",
      vaultName: data.vaultMeta.name,
      assumptions: data.vaultMeta.assumptions,
    };
  }

  if (data.hasTimelineSnapshot && !data.hasLiveTimelineSnapshot) {
    return {
      kind: "staging",
      snapshotSource: data.latestSnapshotSource ?? "unknown",
    };
  }

  if (!hasLiveKpis && hasPlatformWideSignals(data, overview, cockpit)) {
    return {
      kind: "mixed-platform",
      vaultName: data.vaultMeta.name,
      assumptions: data.vaultMeta.assumptions,
    };
  }

  return null;
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
  // Gate on `hasLiveTimelineSnapshot`, not the weaker `hasTimelineSnapshot`.
  // A `daily-seed` row sets `hasTimelineSnapshot = true` but must never
  // activate Live/Attested provenance badges on the admin dashboard.
  const hasLiveKpis = data.hasLiveTimelineSnapshot && !preview;
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
    headlineApy,
    yieldPosture,
    capitalUsdc,
    capitalProvenance,
    proofFresh,
    preview,
  };
}
