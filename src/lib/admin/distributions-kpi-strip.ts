import type { HeroKpi } from "@/lib/data/cockpit";
import { formatUsdCompact } from "@/lib/vaults/product-display";

interface DistributionRow {
  /** Decimal-like with .toNumber() (Prisma Decimal) or plain number. */
  amountUsdc: { toNumber(): number } | number;
  period: string;
  recipientsCount: number;
}

function toNumber(v: { toNumber(): number } | number): number {
  return typeof v === "number" ? v : v.toNumber();
}

/**
 * Derives 3–4 honest KPIs from the distribution history already loaded by
 * the admin/distributions page. No DB queries — pure derivation.
 *
 * Returns [] when there are no distributions (caller suppresses the strip).
 *
 * Provenance:
 * - Count / total / unique recipients → "manual" (operator-confirmed records)
 * - Latest period → "manual"
 */
export function buildDistributionsKpiStrip(
  history: DistributionRow[],
): HeroKpi[] {
  if (history.length === 0) return [];

  const totalUsdc = history.reduce(
    (sum, d) => sum + toNumber(d.amountUsdc),
    0,
  );

  // history is already ordered desc by distributedAt (most recent first).
  const latestPeriod = history[0]?.period ?? "—";

  // Unique recipient counts across periods (max per distribution — distributions
  // may overlap recipients, so summing overstates; we surface max as a floor).
  const maxRecipients = Math.max(...history.map((d) => d.recipientsCount));

  const kpis: HeroKpi[] = [
    {
      label: "Total distributed",
      value: formatUsdCompact(totalUsdc),
      sublabel: `across ${history.length} distribution${history.length === 1 ? "" : "s"}`,
      provenance: "manual",
      accent: true,
    },
    {
      label: "Distributions",
      value: String(history.length),
      sublabel: "confirmed on record",
      provenance: "manual",
    },
    {
      label: "Latest period",
      value: latestPeriod,
      sublabel: `${formatUsdCompact(toNumber(history[0]!.amountUsdc))} USDC`,
      provenance: "manual",
    },
  ];

  if (maxRecipients > 0) {
    kpis.push({
      label: "Max recipients",
      value: String(maxRecipients),
      sublabel: "in a single distribution",
      provenance: "manual",
    });
  }

  return kpis;
}
