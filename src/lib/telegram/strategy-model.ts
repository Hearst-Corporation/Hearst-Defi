/**
 * strategy-model.ts — PURE mining-yield model (no I/O, fully testable).
 *
 * Bridges the Telegram machine economics to a vault-level mining yield, with the
 * TWO company-margin levers Adrien described:
 *
 *   1. MARKUP on the machine price — Letine quotes the COST (prix de revient,
 *      no company margin). The company adds a markup % on top; that marked-up
 *      price is what gets amortized (the "pont"/spread on the sale).
 *   2. REVENUE-SHARE on net mining income — the company keeps a % of the net
 *      mining revenue; the rest is the LP's mining yield.
 *
 *   prix_facturé   = prix_revient × (1 + markup%)
 *   landed         = prix_facturé + freight + customs           (cost-model.ts)
 *   capex/TH/day   = landed / TH / (amort_months × 30.4)
 *   net/TH/day     = hashprice − energy − capex                 (revenu net)
 *   company_cut    = net × companySharePct
 *   lp_yield/TH/day= net − company_cut
 *
 *   Annualized mining yield on the LP's deployed capital:
 *     yield% = (lp_net/TH/day × 365) / landed_per_TH × 100
 *   where landed_per_TH = landed / TH  (the LP's cost basis per TH).
 *
 * All percentages are 0–100. Pure function: same inputs → same output.
 */

import type { MachinePriceSample } from "./parse-machine-price";
import {
  computeMachineEconomics,
  feesForDestination,
  type DestinationCountry,
  type MachineEconomics,
} from "./cost-model";

const DAYS_PER_YEAR = 365;

export interface StrategyParams {
  /** Company markup on the Letine cost price, in percent (the "pont"/spread). */
  markupPct: number;
  /** Company revenue-share on NET mining income, in percent. */
  companySharePct: number;
  /** Destination country (drives customs in the landed cost). */
  destination: DestinationCountry;
  /** Live hashprice (revenue) in $/TH/day. */
  hashpriceUsdPerThDay: number;
}

export interface MachineStrategyResult extends MachineEconomics {
  /** Letine cost price (before company markup). */
  costPriceUsd: number;
  /** Cost price × (1 + markup). This is `exWorksUsd` fed into the economics. */
  billedPriceUsd: number;
  /** Net mining margin $/TH/day (hashprice − energy − capex). Null if no eff. */
  netUsdPerThDay: number | null;
  /** Company's cut $/TH/day. Null if no efficiency. */
  companyCutUsdPerThDay: number | null;
  /** LP's mining margin $/TH/day after company share. Null if no efficiency. */
  lpNetUsdPerThDay: number | null;
  /** Annualized LP mining yield on landed cost basis, in percent. Null if no eff. */
  lpMiningYieldPct: number | null;
}

/**
 * Apply the markup to the cost price, then run the full economics + revenue
 * share to get the LP-facing mining yield for one machine.
 */
export function computeMachineStrategy(
  sample: MachinePriceSample,
  params: StrategyParams,
): MachineStrategyResult {
  const costPriceUsd = sample.priceUsd;
  const billedPriceUsd = round2(costPriceUsd * (1 + params.markupPct / 100));

  // Feed the marked-up price into the cost model as the price to amortize.
  const billedSample: MachinePriceSample = { ...sample, priceUsd: billedPriceUsd };
  const econ = computeMachineEconomics(
    billedSample,
    feesForDestination(params.destination),
  );

  let netUsdPerThDay: number | null = null;
  let companyCutUsdPerThDay: number | null = null;
  let lpNetUsdPerThDay: number | null = null;
  let lpMiningYieldPct: number | null = null;

  if (econ.totalCostUsdPerThDay !== null) {
    netUsdPerThDay = round6(
      params.hashpriceUsdPerThDay - econ.totalCostUsdPerThDay,
    );
    companyCutUsdPerThDay = round6(
      Math.max(0, netUsdPerThDay) * (params.companySharePct / 100),
    );
    lpNetUsdPerThDay = round6(netUsdPerThDay - companyCutUsdPerThDay);

    // Annualized yield on the LP's landed cost basis per TH.
    const landedPerTh = econ.landedUsd / econ.thPerUnit;
    if (landedPerTh > 0) {
      lpMiningYieldPct = round2(
        ((lpNetUsdPerThDay * DAYS_PER_YEAR) / landedPerTh) * 100,
      );
    }
  }

  return {
    ...econ,
    costPriceUsd,
    billedPriceUsd,
    netUsdPerThDay,
    companyCutUsdPerThDay,
    lpNetUsdPerThDay,
    lpMiningYieldPct,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
