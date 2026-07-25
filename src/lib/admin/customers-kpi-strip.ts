import type { HeroKpi } from "@/lib/data/cockpit";
import type { CustomersAggregates } from "@/lib/data/customers";
import { formatUsdCompact } from "@/lib/vaults/product-display";

/**
 * Derives honest KPIs for /admin/customers from WHOLE-POPULATION aggregates
 * (`loadCustomersAggregates()` — Prisma count/groupBy/aggregate without take),
 * never from the 50-row page window. Pure presenter: no DB access here.
 *
 * Returns [] when there are no investors (caller suppresses the strip).
 *
 * Provenance:
 * - All cells → "manual" (operator-managed registry records, not on-chain).
 */
export function buildCustomersKpiStrip(agg: CustomersAggregates): HeroKpi[] {
  if (agg.total === 0) return [];

  const kpis: HeroKpi[] = [
    {
      label: "Total investors",
      value: String(agg.total),
      sublabel: "registered accounts",
      provenance: "manual",
    },
    {
      label: "KYC approved",
      value: String(agg.kycCounts.approved),
      sublabel: `of ${agg.total} investors`,
      provenance: "manual",
      accent: agg.kycCounts.approved > 0,
    },
  ];

  if (agg.kycCounts.pending > 0) {
    kpis.push({
      label: "Pending review",
      value: String(agg.kycCounts.pending),
      sublabel: "KYC pending — all investors",
      provenance: "manual",
      alert: true,
    });
  }

  // Data-quality cell: KYC values the app does not recognise. Surfaced as
  // "unknown", never silently requalified to pending (honesty rule).
  if (agg.kycCounts.unknown > 0) {
    kpis.push({
      label: "Unknown KYC",
      value: String(agg.kycCounts.unknown),
      sublabel: "unrecognised status on record",
      provenance: "manual",
      alert: true,
    });
  }

  if (agg.activePrincipalUsdc > 0) {
    kpis.push({
      label: "Active principal",
      value: formatUsdCompact(agg.activePrincipalUsdc),
      sublabel: `${agg.investorsWithActivePositions} investor${
        agg.investorsWithActivePositions !== 1 ? "s" : ""
      } with active positions`,
      provenance: "manual",
    });
  } else {
    // Honest zero: no capital currently at work — shown, not omitted.
    kpis.push({
      label: "Active principal",
      value: formatUsdCompact(0),
      sublabel: "no active positions",
      provenance: "manual",
    });
  }

  return kpis;
}
