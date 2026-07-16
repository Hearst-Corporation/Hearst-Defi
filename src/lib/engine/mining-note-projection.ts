// v3.0 mining-note projection engine (methodology v3.0.md + VAULT_SPEC_V2.1.md).
//
// PURE: no fetch, no prisma, no Date.now(), no ungoverned Math.random(). The
// seed is an injected input (parity with the MC companion); the base path itself
// is fully deterministic, so the same (inputs, options) always yield the same
// output. Same input → same output (non-negotiable #6, snapshot-friendly).
//
// The product is a BTC-ACCUMULATION mining note, NOT a distributed-yield vault:
//   B1 Mining Power   40% — buys hashrate via revenue-share; net margin → BTC.
//   B2 BTC Pouch      27% — holds BTC (LBTC); take-profit realises to B3.
//   B3 Reserve USDC   33% — funds electricity + DCA, vended to ~0 at maturity.
//
// Over the 24-month term BTC accumulates in B2 and is DELIVERED AT MATURITY.
// There is no periodic cash distribution and no fixed APY. The headline is a
// RANGE of accumulated BTC (non-negotiable #1), carrying `estimated` provenance.

import {
  B1_MINING_ALLOCATION_BPS,
  B2_BTC_ALLOCATION_BPS,
  B3_USDC_ALLOCATION_BPS,
  ALLOCATION_TOTAL_BPS,
  MONTHLY_ELECTRICITY_COST_USD,
  PRODUCT_DURATION_MONTHS,
} from "@/lib/products/dynavault-factsheet";
import { computeMiningRevenue } from "./mining";
import type { Provenance } from "./vaults";
import type {
  MiningNoteInputs,
  MiningNoteMonth,
  MiningNoteProjection,
  MiningNoteRunOptions,
} from "./mining-note-types";

// The verbatim v3.0 §10 disclaimer. It contains the permitted phrase "not
// guaranteed" and none of the §9 forbidden vocabulary.
export const MINING_NOTE_DISCLAIMER =
  "Projections are conditional on stated assumptions. Past performance does not " +
  "guarantee future results. This product is a mining note that accumulates " +
  "Bitcoin over a 24-month term and delivers BTC at maturity — it makes no " +
  "periodic cash distribution and carries no fixed APY. Estimated returns are " +
  "expressed as a range in accumulated BTC and are not guaranteed. Offered " +
  "exclusively to professional / qualified investors via a Cayman Exempted " +
  "Limited Partnership. Minimum subscription and soft lock-up are contractual / " +
  "applicative and not enforced on-chain. Not an offer or solicitation where " +
  "prohibited.";

// The return range is derived/modelled — never live (methodology §3, §7).
const MINING_NOTE_PROVENANCE: Provenance = "estimated";

const DAYS_PER_MONTH = 30;

const B1_WEIGHT = B1_MINING_ALLOCATION_BPS / ALLOCATION_TOTAL_BPS;
const B2_WEIGHT = B2_BTC_ALLOCATION_BPS / ALLOCATION_TOTAL_BPS;
const B3_WEIGHT = B3_USDC_ALLOCATION_BPS / ALLOCATION_TOTAL_BPS;

/**
 * B3 vending curve (methodology §5.2, VAULT_SPEC §7):
 *   monthly_elec_payment_ratio = 1 − (current_month / total_months)
 * The share of the month's electricity bill still paid FROM B3 in USDC. The
 * remainder is funded by selling BTC → USDC, depleting B3 toward 0 at maturity.
 * Clamped to [0, 1]; month 0-guarded by the 1-based caller.
 */
export function vendingRatio(currentMonth: number, totalMonths: number): number {
  if (totalMonths <= 0) return 0;
  return clamp(1 - currentMonth / totalMonths, 0, 1);
}

/**
 * Curtailment predicate (methodology §5.3): B1 mining is paused when BTC price is
 * below the configured threshold, which switches from pre- to post-halving once
 * the term passes the halving month.
 */
export function isCurtailed(
  btcPriceUsd: number,
  month: number,
  halvingMonth: number,
  preHalvingThresholdUsd: number,
  postHalvingThresholdUsd: number,
): boolean {
  const threshold =
    month >= halvingMonth ? postHalvingThresholdUsd : preHalvingThresholdUsd;
  return btcPriceUsd < threshold;
}

/**
 * Runs the v3.0 projection. Produces the deterministic base-path monthly ledger
 * plus the accumulated-BTC RANGE (bear/bull band multipliers). Pure.
 */
export function runMiningNoteProjection(
  inputs: MiningNoteInputs,
  options: MiningNoteRunOptions = {},
): MiningNoteProjection {
  const months = options.months ?? PRODUCT_DURATION_MONTHS;
  const monthlyElecCost =
    inputs.monthlyElectricityCostUsdc ?? MONTHLY_ELECTRICITY_COST_USD;

  const monthly = simulatePath(inputs, months, monthlyElecCost, 1);
  const baseAccumulated = lastAccumulated(monthly);

  // The band is produced by the bear/bull ASSUMPTION multipliers — never by
  // randomness (Monte Carlo is a separate, seeded companion; MVP is rule-based).
  const low = round(baseAccumulated * inputs.bandMultipliers.low, 8);
  const high = round(baseAccumulated * inputs.bandMultipliers.high, 8);

  return {
    btcAccumulatedRange: { low, high },
    monthly,
    assumptions: buildAssumptions(inputs, months, monthlyElecCost),
    disclaimer: MINING_NOTE_DISCLAIMER,
    provenance: MINING_NOTE_PROVENANCE,
  };
}

/**
 * One deterministic path of the monthly accumulation ledger. `bandMultiplier`
 * scales the mining margin and pouch DCA to bracket the estimate; the base path
 * uses 1.
 */
function simulatePath(
  inputs: MiningNoteInputs,
  months: number,
  monthlyElecCost: number,
  bandMultiplier: number,
): MiningNoteMonth[] {
  const ledger: MiningNoteMonth[] = [];

  // B3 reserve is seeded from the 33% pocket; B2 seed BTC is bought at inception.
  let reserveUsdc = inputs.principalUsdc * B3_WEIGHT;
  let btcAccumulated = 0;

  // The B2 pouch's inception BTC purchase (27% of principal at spot).
  if (inputs.btcPriceUsd > 0) {
    const seedBtc = (inputs.principalUsdc * B2_WEIGHT) / inputs.btcPriceUsd;
    btcAccumulated = seedBtc;
  }

  // Net mining margin per TH per day, from the SHARED pure helper (mining.ts).
  const revenue = computeMiningRevenue({
    btc_price_change_pct: 0,
    hashprice_usd_th_day: inputs.hashpriceUsdThDay,
    energy_cost_kwh: 0,
    stable_apy_pct: 0,
    vol_index: 0,
  });
  const netMarginPerThDay = revenue.net_margin_usd_th_day;

  let btcPriceUsd = inputs.btcPriceUsd;

  for (let month = 1; month <= months; month++) {
    const curtailed = isCurtailed(
      btcPriceUsd,
      month,
      inputs.curtailment.halvingMonth,
      inputs.curtailment.preHalvingThresholdUsd,
      inputs.curtailment.postHalvingThresholdUsd,
    );
    const fleetActive = !curtailed;

    // Gross mining revenue for the month (0 when curtailed — fleet paused).
    const miningRevenueUsd = fleetActive
      ? inputs.hashpriceUsdThDay *
        inputs.deployedHashrateTh *
        inputs.uptimePct *
        DAYS_PER_MONTH
      : 0;

    // Net mining MARGIN accrues to the note as BTC (methodology §4). Margin is
    // net-of-cost per TH/day scaled by fleet size, uptime and days; floored at 0.
    const netMarginUsd = fleetActive
      ? Math.max(
          0,
          netMarginPerThDay *
            inputs.deployedHashrateTh *
            inputs.uptimePct *
            DAYS_PER_MONTH,
        ) * bandMultiplier
      : 0;

    // Electricity: pay the B3-funded portion from reserve (vending curve), and
    // fund the rest by selling BTC → USDC (which reduces the pouch).
    const ratio = vendingRatio(month, months);
    const elecFromReserve = Math.min(reserveUsdc, monthlyElecCost * ratio);
    const elecFromBtc = monthlyElecCost - elecFromReserve;
    reserveUsdc = round(reserveUsdc - elecFromReserve, 6);

    // BTC bought this month = mining margin → BTC + reserve-DCA on dips.
    // Reserve DCA: a slice of remaining reserve buys BTC when the fleet runs,
    // funneling B3 surplus into the pouch (VAULT_SPEC §7 optimised DCA).
    let btcBought = 0;
    let btcSold = 0;

    if (btcPriceUsd > 0) {
      const marginBtc = netMarginUsd / btcPriceUsd;

      // A modest deterministic DCA slice of the reserve buys BTC each active
      // month, tapering as B3 vends toward 0.
      const dcaUsdc = fleetActive ? reserveUsdc * B1_WEIGHT * ratio : 0;
      const dcaBtc = dcaUsdc / btcPriceUsd;
      reserveUsdc = round(reserveUsdc - dcaUsdc, 6);

      btcBought = round(marginBtc + dcaBtc, 8);
      btcAccumulated = round(btcAccumulated + btcBought, 8);

      // Cover the BTC-funded electricity slice by selling from the pouch.
      const elecBtc = elecFromBtc / btcPriceUsd;

      // Take-profit: realise a configured fraction of the pouch to USDC, locked
      // into B3 (methodology §5.1). Highest armed tier that the price clears.
      const tpBtc = takeProfitBtc(inputs.takeProfitTiers, btcPriceUsd, btcAccumulated);
      const usdcFromTp = tpBtc * btcPriceUsd;
      reserveUsdc = round(reserveUsdc + usdcFromTp, 6);

      btcSold = round(elecBtc + tpBtc, 8);
      btcAccumulated = round(Math.max(0, btcAccumulated - btcSold), 8);
    }

    ledger.push({
      month,
      btcPriceUsd: round(btcPriceUsd, 2),
      fleetActive,
      curtailed,
      miningRevenueUsd: round(miningRevenueUsd, 2),
      electricityPaidUsdc: round(elecFromReserve + elecFromBtc, 2),
      reserveUsdc: round(reserveUsdc, 2),
      vendingRatio: round(ratio, 6),
      btcBoughtThisMonth: btcBought,
      btcSoldThisMonth: btcSold,
      btcAccumulated,
    });

    // Advance the deterministic BTC price path for next month.
    btcPriceUsd = round(btcPriceUsd * (1 + inputs.monthlyBtcDriftPct), 2);
  }

  return ledger;
}

/**
 * BTC realised by take-profit this month: the single highest-priced armed tier
 * the current price clears, applied to the current pouch. One tier fires per
 * month to keep the base path deterministic and monotone.
 */
function takeProfitBtc(
  tiers: readonly { btcPriceUsd: number; sellBps: number }[],
  btcPriceUsd: number,
  pouchBtc: number,
): number {
  let best: { btcPriceUsd: number; sellBps: number } | null = null;
  for (const tier of tiers) {
    if (btcPriceUsd >= tier.btcPriceUsd) {
      if (best === null || tier.btcPriceUsd > best.btcPriceUsd) best = tier;
    }
  }
  if (best === null) return 0;
  return round((pouchBtc * best.sellBps) / ALLOCATION_TOTAL_BPS, 8);
}

function lastAccumulated(ledger: readonly MiningNoteMonth[]): number {
  if (ledger.length === 0) return 0;
  return ledger[ledger.length - 1]!.btcAccumulated;
}

function buildAssumptions(
  inputs: MiningNoteInputs,
  months: number,
  monthlyElecCost: number,
): string[] {
  return [
    `Term ${months} months; BTC is accumulated over the term and delivered at maturity — no periodic cash distribution, no fixed APY.`,
    `Fixed on-chain pockets B1 Mining ${Math.round(B1_WEIGHT * 100)}% / B2 BTC Pouch ${Math.round(B2_WEIGHT * 100)}% / B3 Reserve ${Math.round(B3_WEIGHT * 100)}% (PermissionedDynaVault v2.1 §Appendix).`,
    `Deployed hashrate ${inputs.deployedHashrateTh} TH/s at hashprice $${inputs.hashpriceUsdThDay}/TH/day, uptime ${round(inputs.uptimePct * 100, 1)}%.`,
    `Monthly electricity ${monthlyElecCost} USDC settled from B3 along the vending curve (1 − month/term), the remainder funded by selling BTC → USDC.`,
    `BTC price starts at $${inputs.btcPriceUsd} and drifts ${round(inputs.monthlyBtcDriftPct * 100, 2)}%/month on the base path.`,
    `Curtailment pauses B1 when BTC price is below $${inputs.curtailment.preHalvingThresholdUsd} pre-halving / $${inputs.curtailment.postHalvingThresholdUsd} post-halving (halving month ${inputs.curtailment.halvingMonth}).`,
    inputs.takeProfitTiers.length > 0
      ? `Take-profit realises a configured fraction of the B2 pouch to B3 at ${inputs.takeProfitTiers.map((t) => `$${t.btcPriceUsd} (${t.sellBps / 100}%)`).join(", ")}.`
      : "No take-profit tiers configured; the B2 pouch is not realised over the term.",
    `Estimated accumulated-BTC range is bracketed by bear (×${inputs.bandMultipliers.low}) / bull (×${inputs.bandMultipliers.high}) assumption multipliers, not a probability distribution.`,
    "Values are estimated / modelled projections, not chain reads, and are not guaranteed.",
  ];
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
