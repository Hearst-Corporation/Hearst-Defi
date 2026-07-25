import type { HeroKpi } from "@/lib/data/cockpit";
import { formatUsdCompact } from "@/lib/vaults/product-display";

interface DistributionRow {
  /** Decimal-like with .toNumber() (Prisma Decimal) or plain number. */
  amountUsdc: { toNumber(): number } | number;
  period: string;
  recipientsCount: number;
}

/**
 * Aggregate totals over the FULL scoped population (Prisma `aggregate`, no
 * `take`). The KPI strip must never be derived from a display window: the
 * old `take: 6` variant presented a 6-row subtotal as "Total distributed"
 * (honesty table TOP4 — FABRIQUÉ/fenêtre).
 */
export interface DistributionTotals {
  /** Σ amountUsdc over ALL records in scope (aggregate _sum). */
  totalUsdc: number;
  /** COUNT of ALL records in scope (aggregate _count). */
  recordCount: number;
  /** MAX recipientsCount over ALL records in scope (aggregate _max). */
  maxRecipients: number | null;
}

function toNumber(v: { toNumber(): number } | number): number {
  return typeof v === "number" ? v : v.toNumber();
}

/**
 * Derives honest KPIs for the retired payout archive (/admin/distributions).
 *
 * - `totals` comes from a windowless `aggregate` — the ONLY source for the
 *   "Total paid out (legacy)" / record-count / max-recipients figures.
 * - `latest` is the head of the desc-ordered history window (genuinely the
 *   most recent record — a window head is valid for "latest", never for sums).
 *
 * Returns [] when there are no records (caller suppresses the strip).
 *
 * Provenance travels WITH each KPI (rendered as-is by the view, zero
 * render-time literals): these are operator-entered archive records → "manual".
 */
export function buildDistributionsKpiStrip(
  totals: DistributionTotals,
  latest: DistributionRow | null,
): HeroKpi[] {
  if (totals.recordCount === 0) return [];

  const kpis: HeroKpi[] = [
    {
      label: "Total paid out (legacy)",
      value: formatUsdCompact(totals.totalUsdc),
      sublabel: `across ${totals.recordCount} legacy payout record${totals.recordCount === 1 ? "" : "s"}`,
      provenance: "manual",
      accent: true,
    },
    {
      label: "Legacy payout records",
      value: String(totals.recordCount),
      sublabel: "confirmed on record",
      provenance: "manual",
    },
  ];

  if (latest !== null) {
    kpis.push({
      label: "Latest period",
      value: latest.period,
      sublabel: `${formatUsdCompact(toNumber(latest.amountUsdc))} USDC`,
      provenance: "manual",
    });
  }

  if (totals.maxRecipients !== null && totals.maxRecipients > 0) {
    kpis.push({
      label: "Max recipients",
      value: String(totals.maxRecipients),
      sublabel: "in a single payout record",
      provenance: "manual",
    });
  }

  return kpis;
}
