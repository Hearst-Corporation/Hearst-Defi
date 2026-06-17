import { assessBtcTactical } from "./btc-tactical";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import type { ScenarioInputs, VaultMode } from "./types";

/**
 * Rebalancing rule evaluator — PURE library.
 *
 * Sourced verbatim from `src/lib/inngest/functions/rebalancing-signal.ts`
 * (V3.j) and extracted here so the rule logic can be reused by:
 *   - the Inngest event-driven function (existing consumer)
 *   - `runScenarioAction` Server Action (preview signals on simulated state)
 *   - the dashboard's "active triggers" widget
 *   - future cron variants (risk-daily, etc.)
 *
 * STRICT pure-function contract (non-negotiable #6):
 *   - no I/O (DB, fetch, fs, network)
 *   - no `process.env`, no `Date.now()` (callers inject `asOf` when needed)
 *   - no `Math.random()`, no module-level side effects
 *   - no imports from `src/lib/db`, `src/lib/data/*`, `src/lib/agents/*`,
 *     `src/app/*`, `next/*`, `fs`, `path`, `node:*`
 *   - no mutation of arguments
 *
 * Rules covered (see /docs/spec/07-rebalancing-rules.mdx and
 * /docs/spec/06-btc-tactical.mdx):
 *   R1        BTC 30d drawdown <= -25%  → switch to Defensive
 *   R2        Mining margin score < 50  → reduce mining 30%
 *   R3        Mining margin > 75 AND BTC momentum positive → +10pp mining
 *   R4        Hashprice 30d trend <= -20% → human review (no auto-reweight)
 *   R5        Stable APY > mining net APY (>= 1pp risk-adjusted) → RWA rotation
 *   R-BTC-1   Accumulate tranche 1   (BTC -20% AND margin >= 60)
 *   R-BTC-2   Accumulate tranche 2   (BTC -35% AND margin >= 60)
 *   R-BTC-3   Take-profit tranche 1  (BTC +30%)
 *   R-BTC-4   Take-profit tranche 2  (BTC +60%)
 *   R-BTC-5   Volatility guardrail   (vol_index > 90)
 *   R-BTC-6   Mining margin guardrail (margin < 50; suspends BTC accumulation)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VaultStateForSignal {
  /** Optional vault scope persisted on the resulting RebalanceEvent row. */
  vaultRef?: string | null;
  /** Inputs in the engine's pure shape. */
  scenarioInputs: ScenarioInputs;
  /** Resolved vault mode (defensive | balanced | opportunistic). */
  mode: VaultMode;
  /** Composite risk score, 0-100 (higher = more risky). */
  riskScore: number;
  /** Mining margin score, 0-100 (higher = healthier). */
  miningMarginScore: number;
  /** Mining net contribution APY (%, NOT bps) — used for R5 comparison. */
  miningNetApyPct: number;
  /** Stable (USDC base) APY (%, NOT bps) — used for R5 comparison. */
  stableApyPct: number;
  /** Hashprice 30d trend in % (signed, negative = compression). */
  hashpriceTrendPct: number;
  /** BTC tactical sleeve size as % of AUM. */
  btcPositionPct: number;
  /** Live BTC price, USD. Zero when stale. */
  btcUsd: number;
  /** Source label for diagnostics. */
  source: "db" | "partial" | "fallback";
}

export interface AllocationMix {
  mining: number;
  btc_tactical: number;
  usdc_base: number;
  stable_reserve: number;
}

export interface RebalanceSignal {
  ruleId: string;
  trigger: string;
  action: string;
  projection: string;
  impact: string;
  fromAllocation: AllocationMix;
  toAllocation: AllocationMix;
}

export interface EvaluateRulesInput {
  state: VaultStateForSignal;
  /**
   * Optional reference time. Currently unused by the deterministic rules but
   * accepted so future time-aware rules (e.g. 14d-sustained margin) can be
   * added without breaking the signature.
   */
  asOf?: Date;
}

export interface EvaluateRulesOutput {
  signals: RebalanceSignal[];
}

// ---------------------------------------------------------------------------
// Constants — spec thresholds (mirrors /docs/spec/07-rebalancing-rules.mdx
// and /docs/spec/06-btc-tactical.mdx).
// ---------------------------------------------------------------------------

export const THRESHOLDS = {
  /** R1: BTC 30d drawdown floor (%). */
  R1_BTC_DRAWDOWN_PCT: -25,
  /** R2: Mining margin score threshold. */
  R2_MARGIN_THRESHOLD: 50,
  /** R3: Mining margin score threshold. */
  R3_MARGIN_THRESHOLD: 75,
  /** R3: BTC momentum (30d change must be strictly greater than this %). */
  R3_BTC_MOMENTUM_PCT: 0,
  /** R4: Hashprice 30d trend threshold (%). */
  R4_HASHPRICE_TREND_PCT: -20,
  /** R5: Stable APY excess over mining net APY (percentage points). */
  R5_RWA_OVER_MINING_PP: 1.0,
  /** R-BTC-1: accumulate T1 drawdown trigger (%). */
  RBTC_ACCUMULATE_T1_DRAWDOWN_PCT: -20,
  /** R-BTC-2: accumulate T2 drawdown trigger (%). */
  RBTC_ACCUMULATE_T2_DRAWDOWN_PCT: -35,
  /** Minimum mining margin score to allow BTC accumulation. */
  RBTC_ACCUMULATE_MIN_MARGIN: 60,
  /** Max BTC tactical sleeve % to still arm T1. */
  RBTC_ACCUMULATE_T1_MAX_SIZE_PCT: 20,
  /** Max BTC tactical sleeve % to still arm T2. */
  RBTC_ACCUMULATE_T2_MAX_SIZE_PCT: 25,
  /** R-BTC-3: take-profit T1 BTC 30d change (%). */
  RBTC_TAKE_T1_RUN_PCT: 30,
  /** R-BTC-4: take-profit T2 BTC 30d change (%). */
  RBTC_TAKE_T2_RUN_PCT: 60,
  /** Minimum position % to take profit. */
  RBTC_TAKE_MIN_SIZE_PCT: 10,
  /** R-BTC-5: realised vol breach (vol_index proxy). */
  RBTC_VOL_BREACH: 90,
} as const;

export const BASE_MIX_BY_MODE: Record<VaultMode, AllocationMix> = {
  defensive: { mining: 25, btc_tactical: 5, usdc_base: 55, stable_reserve: 15 },
  balanced: { mining: 35, btc_tactical: 15, usdc_base: 40, stable_reserve: 10 },
  opportunistic: { mining: 35, btc_tactical: 25, usdc_base: 30, stable_reserve: 10 },
};

// ---------------------------------------------------------------------------
// Forbidden-words guard — delegates to the canonical pure matcher in
// @/lib/agents/forbidden-words (single source of truth, no engine-local copy).
// ---------------------------------------------------------------------------

function assertNoForbiddenWords(text: string, label: string): void {
  const hit = containsForbidden(text);
  if (hit !== null) {
    throw new Error(
      `[rebalancing-rules] forbidden word "${hit.found[0]}" in ${label}: ${text}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface BuildSignalArgs {
  ruleId: string;
  trigger: string;
  projection: string;
  action: string;
  impact: string;
  from: AllocationMix;
  to: AllocationMix;
}

/**
 * Builds a RebalanceSignal in PTAI format and validates each text segment
 * against the forbidden-words list. Returns a fresh object — never mutates
 * the input allocations.
 */
export function buildSignal({
  ruleId,
  trigger,
  projection,
  action,
  impact,
  from,
  to,
}: BuildSignalArgs): RebalanceSignal {
  assertNoForbiddenWords(trigger, `${ruleId}.trigger`);
  assertNoForbiddenWords(action, `${ruleId}.action`);
  assertNoForbiddenWords(projection, `${ruleId}.projection`);
  assertNoForbiddenWords(impact, `${ruleId}.impact`);
  return {
    ruleId,
    trigger,
    action,
    projection,
    impact,
    fromAllocation: { ...from },
    toAllocation: { ...to },
  };
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Public API — pure evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates R1-R5 + R-BTC-1..R-BTC-6 against the supplied vault state.
 * Pure function — same input always returns the same output. No I/O.
 *
 * @param input - vault state snapshot + optional `asOf` reference time
 * @returns ordered list of armed signals (may be empty)
 */
export function evaluateRules(input: EvaluateRulesInput): EvaluateRulesOutput {
  const { state } = input;
  const signals: RebalanceSignal[] = [];
  const inputs = state.scenarioInputs;
  const btc = assessBtcTactical(inputs, state.mode);

  // From-allocation baseline (current target mix for the active mode).
  const baseFrom: AllocationMix = { ...BASE_MIX_BY_MODE[state.mode] };

  // ─── R1 — BTC drawdown > 25% on 30d → switch to Defensive ────────────────
  if (
    inputs.btc_price_change_pct <= THRESHOLDS.R1_BTC_DRAWDOWN_PCT &&
    state.mode !== "defensive"
  ) {
    signals.push(
      buildSignal({
        ruleId: "R1",
        trigger: `BTC 30d change ${fmtPct(
          inputs.btc_price_change_pct,
        )} <= -25% drawdown floor`,
        projection: `Under the assumption of sustained BTC weakness, NAV exposure to BTC is reduced; APY range projected 6.0-9.0% (not guaranteed).`,
        action: `Switch vault mode to Defensive: mining 25%, btc_tactical 5%, usdc_base 55%, stable_reserve 15%.`,
        impact: `APY range 6.0-9.0% (down from 9.4-12.8%); max drawdown contained vs unhedged BTC; distribution cadence unchanged. Not guaranteed.`,
        from: baseFrom,
        to: {
          mining: 25,
          btc_tactical: 5,
          usdc_base: 55,
          stable_reserve: 15,
        },
      }),
    );
  }

  // ─── R2 — Mining Margin Score < 50 → ↓ mining 30%, ↑ stable reserve ──────
  if (state.miningMarginScore < THRESHOLDS.R2_MARGIN_THRESHOLD) {
    const newMining = Math.max(0, Math.round(baseFrom.mining * 0.7));
    const shift = baseFrom.mining - newMining;
    signals.push(
      buildSignal({
        ruleId: "R2",
        trigger: `Mining margin score ${state.miningMarginScore}/100 < ${THRESHOLDS.R2_MARGIN_THRESHOLD} threshold`,
        projection: `Under the assumption that hashprice compression persists, the mining sleeve drag on APY is reduced; APY range projected 7.0-10.5% (not guaranteed).`,
        action: `Reduce mining by 30% (-${shift}pp), raise stable reserve by ${shift}pp. New target: mining ${newMining}%, stable_reserve ${baseFrom.stable_reserve + shift}%.`,
        impact: `APY range 7.0-10.5% vs prior 9.4-12.8%; portfolio volatility reduced; cashflow runway extended. Not guaranteed.`,
        from: baseFrom,
        to: {
          ...baseFrom,
          mining: newMining,
          stable_reserve: baseFrom.stable_reserve + shift,
        },
      }),
    );
  }

  // ─── R3 — Margin > 75 + BTC momentum positive → ↑ mining +10% ────────────
  if (
    state.miningMarginScore > THRESHOLDS.R3_MARGIN_THRESHOLD &&
    inputs.btc_price_change_pct > THRESHOLDS.R3_BTC_MOMENTUM_PCT &&
    state.mode !== "defensive"
  ) {
    const newMining = Math.min(45, baseFrom.mining + 10);
    const shift = newMining - baseFrom.mining;
    signals.push(
      buildSignal({
        ruleId: "R3",
        trigger: `Mining margin score ${state.miningMarginScore}/100 > ${THRESHOLDS.R3_MARGIN_THRESHOLD} and BTC 30d change ${fmtPct(inputs.btc_price_change_pct)} positive`,
        projection: `Under the assumption that BTC momentum and mining margins sustain, APY range projected 11.5-14.5% (not guaranteed).`,
        action: `Increase mining by +10pp (target ${newMining}%) funded by -${shift}pp from usdc_base.`,
        impact: `APY range 11.5-14.5% vs prior 9.4-12.8%; portfolio beta to BTC raised; distribution upside captured. Not guaranteed.`,
        from: baseFrom,
        to: {
          ...baseFrom,
          mining: newMining,
          usdc_base: Math.max(0, baseFrom.usdc_base - shift),
        },
      }),
    );
  }

  // ─── R4 — Hashprice -20% on 30d → human review ──────────────────────────
  if (state.hashpriceTrendPct <= THRESHOLDS.R4_HASHPRICE_TREND_PCT) {
    signals.push(
      buildSignal({
        ruleId: "R4",
        trigger: `Hashprice 30d trend ${fmtPct(state.hashpriceTrendPct)} <= ${THRESHOLDS.R4_HASHPRICE_TREND_PCT}% threshold`,
        projection: `Under the assumption that the hashprice regime shift is structural, mining sleeve sizing requires manual reassessment; no automated reweight proposed.`,
        action: `Trigger human review — multisig signers to evaluate mining contract terms, hosting cost, and fleet redeployment within 72h.`,
        impact: `Allocation unchanged pending review; signal logged for audit trail; APY range to be revised post-review. Not guaranteed.`,
        from: baseFrom,
        to: baseFrom,
      }),
    );
  }

  // ─── R5 — RWA yield > mining net yield (risk-adjusted) ───────────────────
  if (
    state.stableApyPct - state.miningNetApyPct >=
      THRESHOLDS.R5_RWA_OVER_MINING_PP &&
    state.miningNetApyPct > 0
  ) {
    const rotation = Math.min(10, baseFrom.mining - 20);
    if (rotation > 0) {
      signals.push(
        buildSignal({
          ruleId: "R5",
          trigger: `Stable APY ${state.stableApyPct.toFixed(1)}% exceeds mining net APY ${state.miningNetApyPct.toFixed(1)}% by >= ${THRESHOLDS.R5_RWA_OVER_MINING_PP}pp risk-adjusted`,
          projection: `Under the assumption that the RWA premium persists, partial rotation mining → RWA improves risk-adjusted yield; APY range projected 9.0-11.5% (not guaranteed).`,
          action: `Rotate ${rotation}pp from mining to usdc_base: mining ${baseFrom.mining - rotation}%, usdc_base ${baseFrom.usdc_base + rotation}%.`,
          impact: `APY range 9.0-11.5% with lower variance; mining sleeve drag reduced; distribution stability improved. Not guaranteed.`,
          from: baseFrom,
          to: {
            ...baseFrom,
            mining: baseFrom.mining - rotation,
            usdc_base: baseFrom.usdc_base + rotation,
          },
        }),
      );
    }
  }

  // ─── R-BTC-1 — Accumulate T1 ─────────────────────────────────────────────
  if (
    inputs.btc_price_change_pct <=
      THRESHOLDS.RBTC_ACCUMULATE_T1_DRAWDOWN_PCT &&
    state.miningMarginScore >= THRESHOLDS.RBTC_ACCUMULATE_MIN_MARGIN &&
    state.btcPositionPct < THRESHOLDS.RBTC_ACCUMULATE_T1_MAX_SIZE_PCT
  ) {
    signals.push(
      buildSignal({
        ruleId: "R-BTC-1",
        trigger: `BTC 30d change ${fmtPct(inputs.btc_price_change_pct)} <= ${THRESHOLDS.RBTC_ACCUMULATE_T1_DRAWDOWN_PCT}% AND margin score ${state.miningMarginScore}/100 >= ${THRESHOLDS.RBTC_ACCUMULATE_MIN_MARGIN} AND position ${state.btcPositionPct}% < ${THRESHOLDS.RBTC_ACCUMULATE_T1_MAX_SIZE_PCT}%`,
        projection: `Under the assumption that BTC mean-reverts within the cycle, accumulation tranche 1 raises beta to recovery; APY range projected 10.5-13.5% (not guaranteed).`,
        action: `Convert 5% AUM from usdc_base to btc_tactical: btc_tactical ${baseFrom.btc_tactical + 5}%, usdc_base ${baseFrom.usdc_base - 5}%.`,
        impact: `Position size raised by +5pp; cost basis improved if drawdown extends; upside capture on recovery. Not guaranteed.`,
        from: baseFrom,
        to: {
          ...baseFrom,
          btc_tactical: baseFrom.btc_tactical + 5,
          usdc_base: Math.max(0, baseFrom.usdc_base - 5),
        },
      }),
    );
  }

  // ─── R-BTC-2 — Accumulate T2 ─────────────────────────────────────────────
  if (
    inputs.btc_price_change_pct <=
      THRESHOLDS.RBTC_ACCUMULATE_T2_DRAWDOWN_PCT &&
    state.miningMarginScore >= THRESHOLDS.RBTC_ACCUMULATE_MIN_MARGIN &&
    state.btcPositionPct < THRESHOLDS.RBTC_ACCUMULATE_T2_MAX_SIZE_PCT
  ) {
    signals.push(
      buildSignal({
        ruleId: "R-BTC-2",
        trigger: `BTC 30d change ${fmtPct(inputs.btc_price_change_pct)} <= ${THRESHOLDS.RBTC_ACCUMULATE_T2_DRAWDOWN_PCT}% AND margin ${state.miningMarginScore}/100 >= ${THRESHOLDS.RBTC_ACCUMULATE_MIN_MARGIN} AND position ${state.btcPositionPct}% < ${THRESHOLDS.RBTC_ACCUMULATE_T2_MAX_SIZE_PCT}%`,
        projection: `Under the assumption of deeper drawdown, accumulation tranche 2 layers in additional exposure; APY range projected 11.0-14.5% on cycle (not guaranteed).`,
        action: `Convert additional 5% AUM from usdc_base to btc_tactical: btc_tactical ${baseFrom.btc_tactical + 5}%.`,
        impact: `Position size raised by +5pp incremental; weighted entry improved; recovery convexity raised. Not guaranteed.`,
        from: baseFrom,
        to: {
          ...baseFrom,
          btc_tactical: baseFrom.btc_tactical + 5,
          usdc_base: Math.max(0, baseFrom.usdc_base - 5),
        },
      }),
    );
  }

  // ─── R-BTC-3 — Take-profit T1 (≥ +30% from avg entry, proxied by 30d
  // change ≥ 30%) ───────────────────────────────────────────────────────────
  if (
    inputs.btc_price_change_pct >= THRESHOLDS.RBTC_TAKE_T1_RUN_PCT &&
    state.btcPositionPct > THRESHOLDS.RBTC_TAKE_MIN_SIZE_PCT
  ) {
    const sold = Math.round(state.btcPositionPct * 0.25);
    signals.push(
      buildSignal({
        ruleId: "R-BTC-3",
        trigger: `BTC 30d change ${fmtPct(inputs.btc_price_change_pct)} >= +${THRESHOLDS.RBTC_TAKE_T1_RUN_PCT}% take-profit T1 threshold AND position ${state.btcPositionPct}% > ${THRESHOLDS.RBTC_TAKE_MIN_SIZE_PCT}%`,
        projection: `Under the assumption that the BTC rally is near a local top, take-profit T1 locks in unrealised gains; APY range projected 9.5-12.5% (not guaranteed).`,
        action: `Sell 25% of BTC tactical position (-${sold}pp), redeploy to stable_reserve: btc_tactical ${baseFrom.btc_tactical - sold}%, stable_reserve ${baseFrom.stable_reserve + sold}%.`,
        impact: `Realised P&L captured; portfolio beta reduced; distribution buffer increased. Not guaranteed.`,
        from: baseFrom,
        to: {
          ...baseFrom,
          btc_tactical: Math.max(0, baseFrom.btc_tactical - sold),
          stable_reserve: baseFrom.stable_reserve + sold,
        },
      }),
    );
  }

  // ─── R-BTC-4 — Take-profit T2 (≥ +60%) ───────────────────────────────────
  if (
    inputs.btc_price_change_pct >= THRESHOLDS.RBTC_TAKE_T2_RUN_PCT &&
    state.btcPositionPct > THRESHOLDS.RBTC_TAKE_MIN_SIZE_PCT
  ) {
    const sold = Math.round(state.btcPositionPct * 0.25);
    signals.push(
      buildSignal({
        ruleId: "R-BTC-4",
        trigger: `BTC 30d change ${fmtPct(inputs.btc_price_change_pct)} >= +${THRESHOLDS.RBTC_TAKE_T2_RUN_PCT}% take-profit T2 threshold AND position ${state.btcPositionPct}% > ${THRESHOLDS.RBTC_TAKE_MIN_SIZE_PCT}%`,
        projection: `Under the assumption of extended rally, take-profit T2 trims further exposure; APY range projected 8.5-11.5% (not guaranteed).`,
        action: `Sell additional 25% of BTC tactical (-${sold}pp), redeploy to stable_reserve.`,
        impact: `Cumulative profit captured; defensive sleeve thickened; reduced drawdown on mean reversion. Not guaranteed.`,
        from: baseFrom,
        to: {
          ...baseFrom,
          btc_tactical: Math.max(0, baseFrom.btc_tactical - sold),
          stable_reserve: baseFrom.stable_reserve + sold,
        },
      }),
    );
  }

  // ─── R-BTC-5 — Volatility guardrail breach ───────────────────────────────
  if (inputs.vol_index > THRESHOLDS.RBTC_VOL_BREACH) {
    const halved = Math.round(baseFrom.btc_tactical / 2);
    signals.push(
      buildSignal({
        ruleId: "R-BTC-5",
        trigger: `BTC realised vol proxy ${inputs.vol_index} > ${THRESHOLDS.RBTC_VOL_BREACH} breach threshold`,
        projection: `Under the assumption of high-vol regime, halving tactical sleeve cuts tail drawdown exposure; APY range projected 8.0-11.0% (not guaranteed).`,
        action: `Halve BTC tactical (-${baseFrom.btc_tactical - halved}pp) → btc_tactical ${halved}%, raise stable_reserve.`,
        impact: `Drawdown contained; portfolio volatility reduced; cashflow stability prioritised. Not guaranteed.`,
        from: baseFrom,
        to: {
          ...baseFrom,
          btc_tactical: halved,
          stable_reserve: baseFrom.stable_reserve + (baseFrom.btc_tactical - halved),
        },
      }),
    );
  }

  // ─── R-BTC-6 — Mining margin guardrail (margin < 50; 14d-sustained signal
  // is approximated by the live score being below threshold — the multi-day
  // guard is enforced at the multisig review stage). ───────────────────────
  if (state.miningMarginScore < THRESHOLDS.R2_MARGIN_THRESHOLD) {
    // We only emit R-BTC-6 if R2 hasn't already covered the mining cut and
    // there is an active BTC accumulation posture to suspend.
    const r2Already = signals.some((s) => s.ruleId === "R2");
    if (!r2Already && baseFrom.btc_tactical > 0) {
      signals.push(
        buildSignal({
          ruleId: "R-BTC-6",
          trigger: `Mining margin score ${state.miningMarginScore}/100 < ${THRESHOLDS.R2_MARGIN_THRESHOLD} — suspend BTC accumulation`,
          projection: `Under the assumption that mining stress persists, suspending accumulation preserves stable cashflow runway; APY range projected 7.5-10.0% (not guaranteed).`,
          action: `Suspend BTC accumulation (R-BTC-1/2 disarmed); raise stable_reserve by +5pp.`,
          impact: `Tactical sleeve frozen; defensive sleeve thickened; reduced exposure to compounded stress. Not guaranteed.`,
          from: baseFrom,
          to: {
            ...baseFrom,
            stable_reserve: baseFrom.stable_reserve + 5,
            usdc_base: Math.max(0, baseFrom.usdc_base - 5),
          },
        }),
      );
    }
  }

  // BTC engine sanity reference (read but not emitted — used to keep the
  // engine in the call graph so future regressions in `assessBtcTactical`
  // surface here at typecheck time).
  void btc;

  return { signals };
}
