import type { HeroKpi, HeroKpiProvenance } from "@/lib/data/cockpit";
import { formatUsdCompact } from "@/lib/vaults/product-display";

interface VaultSummaryInput {
  /** principalUsdc already summed per vault (sum of active positions) */
  aumUsdc: number;
  capacityUsdc: number;
  status: string;
}

/**
 * Provenance carried BY THE CALCULATION (règle c2: no provenance literal at
 * render time). The view imports these constants next to the numbers they
 * qualify — one source for the KPI strip AND the table badges.
 *
 * - Sum of LP position rows (Prisma) → "manual": operator-recorded records,
 *   not an on-chain read.
 * - Configured target range / ratio of two manual figures → "estimated":
 *   a projection or derivation, never a measurement.
 */
export const POSITION_SUM_PROVENANCE: HeroKpiProvenance = "manual";
export const TARGET_RANGE_PROVENANCE: HeroKpiProvenance = "estimated";

/**
 * Derives 4 honest KPIs from the COMPLETE vault list loaded by the
 * admin/vaults page — including archived single-run drafts: hiding rows from
 * the table is a display choice, hiding them from the totals would be a lie.
 * No DB queries — pure derivation from in-memory data.
 */
export function buildVaultsKpiStrip(
  vaults: VaultSummaryInput[],
): HeroKpi[] {
  const totalVaults = vaults.length;
  if (totalVaults === 0) return [];

  const liveCount = vaults.filter((v) => v.status === "live").length;
  const notReadyCount = vaults.filter(
    (v) => v.status === "draft" || v.status === "review",
  ).length;

  const totalAum = vaults.reduce((sum, v) => sum + v.aumUsdc, 0);
  const totalCapacity = vaults.reduce((sum, v) => sum + v.capacityUsdc, 0);
  const capacityPct =
    totalCapacity > 0
      ? Math.round((totalAum / totalCapacity) * 100)
      : null;

  const kpis: HeroKpi[] = [
    {
      label: "Total vaults",
      value: String(totalVaults),
      sublabel: liveCount === 1 ? "1 live" : `${liveCount} live`,
      provenance: POSITION_SUM_PROVENANCE,
      accent: liveCount > 0,
    },
    {
      // "Deployed" implies a live, operating vault. When no vault is
      // actually live, the sum is real principal but not yet "deployed" in
      // that sense — label it "Active principal" instead so the KPI never
      // implies capital is earning in a live vault when none exists. The
      // underlying calc (sum of active-position principal) is unchanged.
      label: liveCount > 0 ? "Deployed AUM" : "Active principal",
      value: totalAum > 0 ? formatUsdCompact(totalAum) : "—",
      sublabel: "sum of active positions",
      provenance: POSITION_SUM_PROVENANCE,
    },
    {
      label: "Capacity used",
      value: capacityPct !== null ? `${capacityPct}%` : "—",
      sublabel:
        totalCapacity > 0
          ? `of ${formatUsdCompact(totalCapacity)} total`
          : "no capacity set",
      provenance: TARGET_RANGE_PROVENANCE,
    },
  ];

  if (notReadyCount > 0) {
    kpis.push({
      label: "In pipeline",
      value: String(notReadyCount),
      sublabel: "draft or in review",
      provenance: POSITION_SUM_PROVENANCE,
    });
  }

  return kpis;
}
