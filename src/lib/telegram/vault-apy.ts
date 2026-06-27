/**
 * vault-apy.ts — PURE final composition: 3 buckets → vault APY RANGE
 * (no I/O, fully testable).
 *
 * Closes the strategy loop. Takes the per-bucket yields (mining LP, BTC carry,
 * USDC), derives the allocation (allocator.ts), subtracts the cost of carrying
 * the BTC-collateral loan, and emits an APY as a RANGE — never a single point
 * (product non-negotiable #1) — with assumptions and a "not guaranteed"
 * disclaimer.
 *
 * The BTC bucket carries a SCENARIO band (bear/base/bull) instead of one number:
 * BTC return is the most uncertain input, so it drives the low/high spread.
 * Borrow-cost drag is ALWAYS subtracted so leverage never inflates the headline.
 */

import { allocate, type BucketRisk, DEFAULT_RISK } from "./allocator";

export interface VaultApyInputs {
  /** Net LP mining yield, % (from strategy-model, fleet-level). */
  miningYieldPct: number;
  /** USDC sleeve yield, % (from usdc-yield best pool). */
  usdcYieldPct: number;
  /**
   * BTC expected-return scenario band, %. `base` drives the allocation; `bear`
   * and `bull` drive the APY range spread. e.g. { bear: -20, base: 40, bull: 120 }.
   */
  btcReturn: { bear: number; base: number; bull: number };
  /** Annual borrow APR on the USDC drawn against BTC collateral, %. */
  borrowAprPct: number;
  /** Average LTV maintained (e.g. 0.5 = 50%). Drives borrow-cost drag. */
  avgLtv: number;
  /** Management + performance fees, % per year. */
  feesPct: number;
  /** Optional per-vault allocation bounds (honor a profile). */
  bounds?: Parameters<typeof allocate>[0]["bounds"];
  /** Optional risk overrides. */
  risk?: BucketRisk;
}

export interface VaultApyResult {
  apyLow: number;
  apyHigh: number;
  allocation: { miningPct: number; btcPct: number; usdcPct: number };
  /** Borrow-cost drag subtracted from every scenario, %. */
  borrowDragPct: number;
  assumptions: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "Target projection — not guaranteed; subject to BTC price, hashprice, difficulty, USDC yield and borrow-rate changes.";

/**
 * Compose the vault APY range.
 *
 * Allocation is derived from the BASE scenario (so weights reflect the central
 * view). The range comes from re-pricing the SAME weights under bear vs bull BTC
 * return. Borrow drag = borrowApr × avgLtv × btcWeight (the loan only exists to
 * carry the BTC sleeve) and is subtracted from both ends.
 */
export function composeVaultApy(input: VaultApyInputs): VaultApyResult {
  const risk = input.risk ?? DEFAULT_RISK;

  // Weights from the central (base) view.
  const alloc = allocate({
    miningYieldPct: input.miningYieldPct,
    btcExpectedReturnPct: input.btcReturn.base,
    usdcYieldPct: input.usdcYieldPct,
    risk,
    bounds: input.bounds,
  });

  const wMining = alloc.miningPct / 100;
  const wBtc = alloc.btcPct / 100;
  const wUsdc = alloc.usdcPct / 100;

  // Borrow exists only to fund the BTC-collateral position's electricity loan;
  // drag scales with the BTC weight and the maintained LTV.
  const borrowDragPct = round2(input.borrowAprPct * input.avgLtv * wBtc);

  const scenarioApy = (btcRet: number) =>
    round2(
      wMining * input.miningYieldPct +
        wBtc * btcRet +
        wUsdc * input.usdcYieldPct -
        borrowDragPct -
        input.feesPct,
    );

  const bear = scenarioApy(input.btcReturn.bear);
  const bull = scenarioApy(input.btcReturn.bull);
  const apyLow = Math.min(bear, bull);
  const apyHigh = Math.max(bear, bull);

  return {
    apyLow,
    apyHigh,
    allocation: {
      miningPct: alloc.miningPct,
      btcPct: alloc.btcPct,
      usdcPct: alloc.usdcPct,
    },
    borrowDragPct,
    assumptions: [
      `Allocation (base view): mining ${alloc.miningPct}% · BTC ${alloc.btcPct}% · USDC ${alloc.usdcPct}%.`,
      `Mining LP yield ${input.miningYieldPct}%, USDC yield ${input.usdcYieldPct}%.`,
      `BTC scenario band: bear ${input.btcReturn.bear}% / base ${input.btcReturn.base}% / bull ${input.btcReturn.bull}%.`,
      `Borrow ${input.borrowAprPct}% APR at ${Math.round(input.avgLtv * 100)}% LTV → drag ${borrowDragPct}% (subtracted). Fees ${input.feesPct}%.`,
    ],
    disclaimer: DISCLAIMER,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
