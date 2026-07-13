import { BLOCK_REWARD_BTC, BLOCKS_PER_DAY } from "./hashprice-formula";

/**
 * Bitcoin Strategic Reserve — pure mining-economics + BTC-value math.
 * Composes on top of hashprice-formula.ts (network hashrate / hashprice) and
 * mirrors construction.ts's sentinel style for degenerate div-by-zero inputs
 * (never let NaN/Infinity leak into a caller). No I/O — price, hashrate, cost
 * and clock are always injected.
 */

/** Matches cost-model.ts / construction.ts conventions (kept local per purity boundary). */
const DAYS_PER_MONTH = 30.4;
const DEFAULT_UPTIME = 0.98;
const HALVING_INTERVAL_BLOCKS = 210_000;
const DEFAULT_AVG_BLOCK_MINUTES = 10;
const MS_PER_DAY = 86_400_000;

const DEFAULT_SCENARIO_PRICES_USD = [150_000, 200_000, 300_000, 500_000];

function round(n: number, decimals: number): number {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Price-independent block-reward share: BTC minted per TH/s per day at a
 * given network hashrate. The pivot every per-BTC figure derives from.
 * Non-positive/degenerate network hashrate → 0 (never NaN/Infinity).
 */
export function computeBtcPerThDay(
  networkHashrateThs: number,
  blockRewardBtc: number = BLOCK_REWARD_BTC,
): number {
  if (
    !Number.isFinite(networkHashrateThs) ||
    !Number.isFinite(blockRewardBtc) ||
    networkHashrateThs <= 0
  ) {
    return 0;
  }
  return (blockRewardBtc * BLOCKS_PER_DAY) / networkHashrateThs;
}

export interface ProductionEconomicsInputs {
  totalCostUsdPerThDay: number;
  networkHashrateThs: number;
  btcPriceUsd: number;
  uptime?: number;
  blockRewardBtc?: number;
  /**
   * Fraction (0–1) of hashprice-linked pool/maintenance fees already baked
   * into totalCostUsdPerThDay. Default 0 (fully price-independent cost basis,
   * so break-even = cost-to-produce exactly).
   */
  feeFraction?: number;
}

export interface ProductionEconomics {
  btcPerThDay: number;
  costToProduce1BtcUsd: number;
  productionMarginPerBtcUsd: number;
  productionMarginPct: number;
  breakEvenBtcPriceUsd: number;
  estimatedProfitPerBtcUsd: number;
  costBasis: "fully_loaded";
}

/**
 * Fully-loaded (energy + amortized CAPEX) cost to produce 1 BTC and the
 * resulting margin at a given BTC price. Cash-only cost would be materially
 * lower — costBasis is stamped "fully_loaded" so callers never conflate it
 * with a cash-cost figure.
 */
export function computeProductionEconomics(
  i: ProductionEconomicsInputs,
): ProductionEconomics {
  const uptime = i.uptime ?? DEFAULT_UPTIME;
  const feeFraction = i.feeFraction ?? 0;
  const btcPerThDay = computeBtcPerThDay(i.networkHashrateThs, i.blockRewardBtc);

  const denom = btcPerThDay * uptime;
  const costToProduce1BtcUsd =
    denom > 0 && Number.isFinite(i.totalCostUsdPerThDay)
      ? round(i.totalCostUsdPerThDay / denom, 2)
      : 0;

  const btcPriceUsd = Number.isFinite(i.btcPriceUsd) ? i.btcPriceUsd : 0;
  const productionMarginPerBtcUsd = round(btcPriceUsd - costToProduce1BtcUsd, 2);
  const productionMarginPct =
    btcPriceUsd > 0 ? round((productionMarginPerBtcUsd / btcPriceUsd) * 100, 4) : 0;

  const breakEvenBtcPriceUsd =
    feeFraction > 0 && feeFraction < 1
      ? round(costToProduce1BtcUsd / (1 - feeFraction), 2)
      : costToProduce1BtcUsd;

  return {
    btcPerThDay,
    costToProduce1BtcUsd,
    productionMarginPerBtcUsd,
    productionMarginPct,
    breakEvenBtcPriceUsd,
    estimatedProfitPerBtcUsd: productionMarginPerBtcUsd,
    costBasis: "fully_loaded",
  };
}

export interface FleetProductionInputs {
  fleetHashrateThs: number;
  networkHashrateThs: number;
  uptime?: number;
  blockRewardBtc?: number;
}

export interface FleetProduction {
  btcPerDay: number;
  btcPerMonth: number;
  btcPerYear: number;
}

/**
 * Fleet-level BTC production (day/month/year) at a given share of network
 * hashrate. Zero/degenerate fleet or network hashrate → all-zero, never NaN.
 */
export function computeFleetProduction(i: FleetProductionInputs): FleetProduction {
  const uptime = i.uptime ?? DEFAULT_UPTIME;
  const btcPerThDay = computeBtcPerThDay(i.networkHashrateThs, i.blockRewardBtc);
  const fleetHashrateThs =
    Number.isFinite(i.fleetHashrateThs) && i.fleetHashrateThs > 0 ? i.fleetHashrateThs : 0;

  const btcPerDay = round(fleetHashrateThs * btcPerThDay * uptime, 8);
  const btcPerMonth = round(btcPerDay * DAYS_PER_MONTH, 8);
  const btcPerYear = round(btcPerDay * 365, 8);

  return { btcPerDay, btcPerMonth, btcPerYear };
}

export interface FutureValueScenario {
  targetPriceUsd: number;
  futurePortfolioValueUsd: number;
  currentValueUsd: number;
  gainUsd: number;
  roiPct: number;
  multiple: number;
}

export interface SimulateFutureValueInputs {
  btcReserve: number;
  currentBtcPriceUsd: number;
  scenarioPricesUsd?: number[];
  costBasisUsd?: number;
}

export interface SimulateFutureValueOutput {
  currentValueUsd: number;
  scenarios: FutureValueScenario[];
}

/**
 * Deterministic (NOT probabilistic/Monte-Carlo) BTC reserve valuation at a
 * set of target BTC prices. Pure arithmetic — no PRNG, no seed.
 */
export function simulateFutureValue(
  i: SimulateFutureValueInputs,
): SimulateFutureValueOutput {
  const btcReserve = Number.isFinite(i.btcReserve) && i.btcReserve > 0 ? i.btcReserve : 0;
  const currentBtcPriceUsd =
    Number.isFinite(i.currentBtcPriceUsd) && i.currentBtcPriceUsd > 0
      ? i.currentBtcPriceUsd
      : 0;
  const currentValueUsd = round(btcReserve * currentBtcPriceUsd, 2);
  const costBasisUsd = i.costBasisUsd ?? currentValueUsd;
  const prices = i.scenarioPricesUsd ?? DEFAULT_SCENARIO_PRICES_USD;

  const scenarios: FutureValueScenario[] = prices.map((targetPriceRaw) => {
    const targetPriceUsd = Number.isFinite(targetPriceRaw) ? targetPriceRaw : 0;
    const futurePortfolioValueUsd = round(btcReserve * targetPriceUsd, 2);
    const gainUsd = round(futurePortfolioValueUsd - costBasisUsd, 2);
    const roiPct = costBasisUsd !== 0 ? round((gainUsd / costBasisUsd) * 100, 4) : 0;
    const multiple = currentBtcPriceUsd > 0 ? round(targetPriceUsd / currentBtcPriceUsd, 6) : 0;

    return {
      targetPriceUsd,
      futurePortfolioValueUsd,
      currentValueUsd,
      gainUsd,
      roiPct,
      multiple,
    };
  });

  return { currentValueUsd, scenarios };
}

export interface HalvingCountdownInputs {
  currentBlockHeight: number;
  now: Date;
  avgBlockMinutes?: number;
}

export interface HalvingCountdown {
  currentBlockHeight: number;
  nextHalvingHeight: number;
  blocksRemaining: number;
  estimatedDaysRemaining: number;
  estimatedDate: Date;
  currentEpoch: number;
  currentBlockRewardBtc: number;
  nextBlockRewardBtc: number;
}

/**
 * Halving countdown derived purely from the injected block height and clock
 * (`now`) — no Date.now(). currentBlockRewardBtc = 50 / 2^epoch, which
 * cross-checks hashprice-formula.ts's BLOCK_REWARD_BTC=3.125 at epoch 4
 * (height 840,000, the April-2024 halving).
 */
export function computeHalvingCountdown(i: HalvingCountdownInputs): HalvingCountdown {
  const currentBlockHeight =
    Number.isFinite(i.currentBlockHeight) && i.currentBlockHeight >= 0
      ? Math.floor(i.currentBlockHeight)
      : 0;
  const avgBlockMinutes =
    Number.isFinite(i.avgBlockMinutes) && (i.avgBlockMinutes as number) > 0
      ? (i.avgBlockMinutes as number)
      : DEFAULT_AVG_BLOCK_MINUTES;

  const currentEpoch = Math.floor(currentBlockHeight / HALVING_INTERVAL_BLOCKS);
  const nextHalvingHeight = (currentEpoch + 1) * HALVING_INTERVAL_BLOCKS;
  const blocksRemaining = nextHalvingHeight - currentBlockHeight;
  const estimatedDaysRemaining = round((blocksRemaining * avgBlockMinutes) / 1440, 4);
  const estimatedDate = new Date(i.now.getTime() + estimatedDaysRemaining * MS_PER_DAY);

  const currentBlockRewardBtc = 50 / 2 ** currentEpoch;
  const nextBlockRewardBtc = currentBlockRewardBtc / 2;

  return {
    currentBlockHeight,
    nextHalvingHeight,
    blocksRemaining,
    estimatedDaysRemaining,
    estimatedDate,
    currentEpoch,
    currentBlockRewardBtc,
    nextBlockRewardBtc,
  };
}
