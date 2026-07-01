/**
 * ScenarioRunner — the 24-month monthly portfolio projection. PURE + deterministic:
 * seeded market model, no I/O, no Math.random, no Date.now. Each month it re-prices
 * BTC, accrues economics, then evaluates rebalancing rules (LIQUIDATE before
 * REPURCHASE) and executes them, recording a snapshot.
 */

import {
  applyMonthlyEconomics,
  buyBtc,
  collateralValue,
  liquidationDistanceBps,
  ltvBps,
  netEquity,
  sellBtc,
  BPS,
} from "./portfolio-math";
import { ThresholdRuleEngine } from "./threshold-rule-engine";
import type {
  CollateralConfig,
  ManualProjectionMarket,
  MarketModel,
  MonthlyEvent,
  MonthlySnapshot,
  PortfolioState,
  Scenario,
  ScenarioReport,
} from "./types";

const MONTHS = 24;

export interface ScenarioConfig {
  scenario: Scenario;
  collateral: CollateralConfig;
  market: ManualProjectionMarket;
}

/** Annual bps → monthly bps (simple division; the sim is monthly). */
const monthly = (annualBps: number) => annualBps / 12;

export class ScenarioRunner {
  constructor(
    private readonly config: ScenarioConfig,
    private readonly marketModel: MarketModel,
    private readonly ruleEngine: ThresholdRuleEngine,
  ) {}

  run(initialState: PortfolioState): ScenarioReport {
    const cfg = this.config.collateral;
    const mkt = this.config.market;
    const startPrice = initialState.btcPrice;

    const monthlyYieldBps =
      monthly(mkt.stableYieldAprBps) +
      monthly(mkt.overlayYieldAprBps) +
      monthly(mkt.miningYieldAprBps);
    const monthlyFeeBps = monthly(mkt.feeDragAprBps);
    const monthlyBorrowBps = monthly(cfg.borrowAprBps);

    let state: PortfolioState = { ...initialState };
    const snapshots: MonthlySnapshot[] = [];

    let totalBtcSold = 0;
    let totalBtcBought = 0;
    let totalDebtRepaid = 0;
    let liquidationCount = 0;
    let repurchaseCount = 0;
    let minLiqDistance = liquidationDistanceBps(state, cfg);
    let endedLiquidated = false;

    const startEquity = netEquity(state);

    // Month 0 snapshot (initial state, no events).
    snapshots.push(snapshot(0, state, cfg, []));

    for (let m = 1; m <= MONTHS; m += 1) {
      // 1. Re-price BTC (deterministic).
      state.btcPrice = this.marketModel.priceAt(m, state.btcPrice);

      // 2. Carrying economics (yield / borrow / electricity).
      state = applyMonthlyEconomics(state, cfg, monthlyYieldBps, monthlyFeeBps, monthlyBorrowBps);

      // 3. Rules — LIQUIDATE first, then REPURCHASE.
      const events: MonthlyEvent[] = [];
      const fired = this.ruleEngine.triggeredRules(state, cfg, m, startPrice);

      for (const rule of fired) {
        if (rule.action.side === "SELL_BTC" || rule.action.side === "REPAY_DEBT") {
          const btc = this.ruleEngine.sellSizeBtc(rule, state);
          const { next, debtRepaid, btcSold } = sellBtc(
            state,
            btc,
            rule.action.repayDebtRatioBps ?? BPS,
          );
          state = next;
          totalBtcSold += btcSold;
          totalDebtRepaid += debtRepaid;
          liquidationCount += 1;
          this.ruleEngine.markFired(rule.id, m);
          events.push({
            ruleId: rule.id,
            type: "LIQUIDATE",
            side: rule.action.side,
            btcDelta: -btcSold,
            debtRepaid,
            reason: `${rule.triggerMetric} ${rule.operator} ${rule.value}`,
          });
        } else if (rule.action.side === "BUY_BTC") {
          if (!this.ruleEngine.buyAllowed(rule, state, cfg)) continue;
          const spend = this.ruleEngine.buySizeUsdc(rule, state);
          const { next, btcBought } = buyBtc(state, spend, cfg.minReserveUsdc);
          if (btcBought <= 0) continue;
          state = next;
          totalBtcBought += btcBought;
          repurchaseCount += 1;
          this.ruleEngine.markFired(rule.id, m);
          events.push({
            ruleId: rule.id,
            type: "REPURCHASE",
            side: "BUY_BTC",
            btcDelta: btcBought,
            debtRepaid: 0,
            reason: `${rule.triggerMetric} ${rule.operator} ${rule.value}`,
          });
        }
        // HOLD → no-op.
      }

      // 4. Hard liquidation floor: if LTV is at/above the liquidation LTV after
      //    everything, the position is force-closed (collateral seized to clear
      //    debt). Marks endedLiquidated but the sim continues to month 24.
      if (collateralValue(state) > 0 && ltvBps(state) >= cfg.liquidationLtvBps) {
        const { next, debtRepaid, btcSold } = sellBtc(state, state.btcCollateral, BPS);
        state = next;
        totalBtcSold += btcSold;
        totalDebtRepaid += debtRepaid;
        liquidationCount += 1;
        endedLiquidated = true;
        events.push({
          ruleId: "hard-liquidation",
          type: "LIQUIDATE",
          side: "SELL_BTC",
          btcDelta: -btcSold,
          debtRepaid,
          reason: `LTV ${ltvBps({ ...state, btcCollateral: btcSold })} ≥ liquidation ${cfg.liquidationLtvBps}`,
        });
      }

      const dist = liquidationDistanceBps(state, cfg);
      if (dist < minLiqDistance) minLiqDistance = dist;

      snapshots.push(snapshot(m, state, cfg, events));
    }

    const endEquity = netEquity(state);
    const finalRoiBps = startEquity !== 0 ? Math.round(((endEquity - startEquity) / startEquity) * BPS) : 0;

    return {
      scenario: this.config.scenario,
      snapshots,
      finalRoiBps,
      minLiquidationDistanceBps: minLiqDistance,
      totalBtcSold,
      totalBtcBought,
      totalDebtRepaidUsdc: totalDebtRepaid,
      liquidationCount,
      repurchaseCount,
      endedLiquidated,
    };
  }
}

function snapshot(
  month: number,
  s: PortfolioState,
  cfg: CollateralConfig,
  events: MonthlyEvent[],
): MonthlySnapshot {
  return {
    month,
    btcPrice: round2(s.btcPrice),
    btcCollateral: round8(s.btcCollateral),
    collateralValueUsdc: round2(collateralValue(s)),
    debtUsdc: round2(s.debtUsdc),
    reserveUsdc: round2(s.reserveUsdc),
    ltvBps: ltvBps(s),
    liquidationDistanceBps: liquidationDistanceBps(s, cfg),
    netEquityUsdc: round2(netEquity(s)),
    events,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;
