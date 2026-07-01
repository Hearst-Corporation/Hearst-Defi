/**
 * Portfolio math — pure helpers. bps everywhere for ratios.
 */

import type { CollateralConfig, PortfolioState } from "./types";

export const BPS = 10_000;

export const collateralValue = (s: PortfolioState): number => s.btcCollateral * s.btcPrice;

export const netEquity = (s: PortfolioState): number =>
  collateralValue(s) + s.reserveUsdc - s.debtUsdc;

/** LTV in bps = debt / collateral value. 0 when there is no collateral value. */
export function ltvBps(s: PortfolioState): number {
  const cv = collateralValue(s);
  if (cv <= 0) return s.debtUsdc > 0 ? BPS : 0;
  return Math.round((s.debtUsdc / cv) * BPS);
}

/** Distance (bps) between the current LTV and the liquidation LTV. Higher = safer.
 *  Clamped at 0 (never negative — at/above liquidation LTV it reads 0). */
export function liquidationDistanceBps(s: PortfolioState, cfg: CollateralConfig): number {
  return Math.max(0, cfg.liquidationLtvBps - ltvBps(s));
}

/** Apply one month of carrying economics to a COPY of the state (pure):
 *  reserve earns stable + overlay + mining yield (annual bps → monthly),
 *  minus the fee drag; debt accrues borrow APR; electricity is paid from reserve.
 *  Reserve is floored at 0 (a shortfall becomes new debt so nothing goes negative). */
export function applyMonthlyEconomics(
  state: PortfolioState,
  cfg: CollateralConfig,
  monthlyYieldBps: number,
  monthlyFeeDragBps: number,
  monthlyBorrowBps: number,
): PortfolioState {
  const next: PortfolioState = { ...state };

  // Reserve yield (net of fee drag), on the positive reserve only.
  const yieldNetBps = Math.max(-BPS, monthlyYieldBps - monthlyFeeDragBps);
  const reserveGrowth = next.reserveUsdc > 0 ? (next.reserveUsdc * yieldNetBps) / BPS : 0;
  next.reserveUsdc += reserveGrowth;

  // Debt accrues borrow interest.
  next.debtUsdc += (next.debtUsdc * monthlyBorrowBps) / BPS;

  // Electricity paid from reserve; a shortfall is borrowed (added to debt).
  const elec = cfg.electricityMonthlyCostUsdc;
  if (next.reserveUsdc >= elec) {
    next.reserveUsdc -= elec;
  } else {
    next.debtUsdc += elec - next.reserveUsdc;
    next.reserveUsdc = 0;
  }

  return next;
}

/** Sell `btcAmount` of collateral into USDC, optionally repaying debt by ratio.
 *  Pure — returns the new state + the debt actually repaid. Never negative. */
export function sellBtc(
  state: PortfolioState,
  btcAmount: number,
  repayDebtRatioBps: number,
): { next: PortfolioState; debtRepaid: number; btcSold: number } {
  const sold = Math.min(Math.max(0, btcAmount), state.btcCollateral);
  const proceeds = sold * state.btcPrice;
  const wantRepay = (proceeds * Math.min(BPS, Math.max(0, repayDebtRatioBps))) / BPS;
  const debtRepaid = Math.min(wantRepay, state.debtUsdc);
  const next: PortfolioState = {
    ...state,
    btcCollateral: state.btcCollateral - sold,
    debtUsdc: state.debtUsdc - debtRepaid,
    reserveUsdc: state.reserveUsdc + (proceeds - debtRepaid),
  };
  return { next, debtRepaid, btcSold: sold };
}

/** Buy BTC with `usdcSpend` from reserve, respecting minReserve. Pure. */
export function buyBtc(
  state: PortfolioState,
  usdcSpend: number,
  minReserveUsdc: number,
): { next: PortfolioState; btcBought: number; spent: number } {
  const spendable = Math.max(0, state.reserveUsdc - minReserveUsdc);
  const spend = Math.min(Math.max(0, usdcSpend), spendable);
  const btcBought = state.btcPrice > 0 ? spend / state.btcPrice : 0;
  const next: PortfolioState = {
    ...state,
    reserveUsdc: state.reserveUsdc - spend,
    btcCollateral: state.btcCollateral + btcBought,
  };
  return { next, btcBought, spent: spend };
}
