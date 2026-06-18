import type { HeroKpi } from "@/lib/data/cockpit";
import type { CustomerRow, KycStatus } from "@/lib/data/customers";
import { formatUsdCompact } from "@/lib/vaults/product-display";

/**
 * Derives honest KPIs from the current page of investor rows + the overall
 * total count already fetched by the admin/customers page.
 *
 * NOTE: `customers` is the *current page* — not the full set. Counts of
 * KYC status / investors with positions are therefore scoped to the visible
 * page whenever pageSize < total. We surface this honestly in the sublabel.
 *
 * Provenance:
 * - Counts → "manual" (operator-managed records, not on-chain)
 * - Total deployed principal → "manual" (LP position records, not oracle)
 */
export function buildCustomersKpiStrip(
  customers: CustomerRow[],
  total: number,
): HeroKpi[] {
  if (total === 0) return [];

  // KYC breakdown across the current page
  const kycCounts: Record<KycStatus, number> = {
    approved: 0,
    pending: 0,
    rejected: 0,
  };
  let withPositions = 0;
  let totalPrincipal = 0;

  for (const c of customers) {
    kycCounts[c.kycStatus]++;
    if (c.activePositions > 0) withPositions++;
    totalPrincipal += c.totalPrincipalUsdc;
  }

  const pageScope = customers.length < total;
  const scopeNote = pageScope ? "this page" : "all investors";

  const kpis: HeroKpi[] = [
    {
      label: "Total investors",
      value: String(total),
      sublabel: "registered accounts",
      provenance: "manual",
    },
    {
      label: "KYC approved",
      value: String(kycCounts.approved),
      sublabel: `of ${customers.length} on ${scopeNote}`,
      provenance: "manual",
      accent: kycCounts.approved > 0,
    },
  ];

  if (kycCounts.pending > 0) {
    kpis.push({
      label: "Pending review",
      value: String(kycCounts.pending),
      sublabel: `KYC pending — ${scopeNote}`,
      provenance: "manual",
      alert: true,
    });
  }

  if (totalPrincipal > 0) {
    kpis.push({
      label: "Deployed principal",
      value: formatUsdCompact(totalPrincipal),
      sublabel: `${withPositions} investor${withPositions !== 1 ? "s" : ""} with positions`,
      provenance: "manual",
    });
  } else if (withPositions === 0 && customers.length > 0) {
    // show the "with positions" cell even when principal is zero so operators
    // understand no capital has been deployed yet — honest zero, not omitted.
    kpis.push({
      label: "With positions",
      value: "0",
      sublabel: `no active positions — ${scopeNote}`,
      provenance: "manual",
    });
  }

  return kpis;
}
