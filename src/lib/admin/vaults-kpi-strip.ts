import type { HeroKpi } from "@/lib/data/cockpit";
import { formatUsdCompact } from "@/lib/vaults/product-display";

interface VaultSummaryInput {
  /** principalUsdc already summed per vault (sum of active positions) */
  aumUsdc: number;
  capacityUsdc: number;
  status: string;
}

/**
 * Derives 4 honest KPIs from the full vault list already loaded by the
 * admin/vaults page. No DB queries — pure derivation from in-memory data.
 *
 * Provenance:
 * - Vault counts → "manual" (operator-managed records)
 * - AUM (principal sum) → "manual" (LP position records, not on-chain oracle)
 * - Capacity used → "estimated" (ratio of two manual figures)
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
      provenance: "manual",
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
      provenance: "manual",
    },
    {
      label: "Capacity used",
      value: capacityPct !== null ? `${capacityPct}%` : "—",
      sublabel:
        totalCapacity > 0
          ? `of ${formatUsdCompact(totalCapacity)} total`
          : "no capacity set",
      provenance: "estimated",
    },
  ];

  if (notReadyCount > 0) {
    kpis.push({
      label: "In pipeline",
      value: String(notReadyCount),
      sublabel: "draft or in review",
      provenance: "manual",
    });
  }

  return kpis;
}
