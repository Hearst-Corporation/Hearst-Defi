import { findForbiddenWord } from "./forbidden-words";
import { computeMiningRevenue } from "./mining";
import type {
  BtcGuardrail,
  BtcTacticalAssessment,
  BtcTrigger,
  ScenarioInputs,
  VaultMode,
} from "./types";

const ACCUMULATE_DRAWDOWN_PCT = -20;
const ACCUMULATE_VOL_MAX = 60;
const TAKE_PROFIT_RUN_PCT = 40;
const REDUCE_SIZE_VOL_MIN = 80;

const VOL_BREACHED = 80;
const VOL_WARNING = 65;

const MARGIN_HEALTHY = 70;
const MARGIN_WARNING = 50;

const BASE_TARGET_BY_MODE: Record<VaultMode, number> = {
  defensive: 5,
  balanced: 12,
  opportunistic: 22,
};

const REDUCE_SIZE_MULT = 0.5;
const TAKE_PROFIT_MULT = 0.75;
const ACCUMULATE_MULT = 1.1;
const EXPOSURE_CAP_PCT = 30;

export function assessBtcTactical(
  inputs: ScenarioInputs,
  mode: VaultMode,
): BtcTacticalAssessment {
  const accumulateArmed =
    inputs.btc_price_change_pct <= ACCUMULATE_DRAWDOWN_PCT &&
    inputs.vol_index < ACCUMULATE_VOL_MAX;
  const takeProfitArmed = inputs.btc_price_change_pct >= TAKE_PROFIT_RUN_PCT;
  const reduceSizeArmed = inputs.vol_index > REDUCE_SIZE_VOL_MIN;
  const holdArmed = !accumulateArmed && !takeProfitArmed && !reduceSizeArmed;

  const triggers: BtcTrigger[] = [
    {
      id: "R-BTC-1",
      kind: "accumulate",
      condition: `BTC 30d change <= ${ACCUMULATE_DRAWDOWN_PCT}% AND vol_index < ${ACCUMULATE_VOL_MAX}`,
      action: "convert 5% AUM USDC -> BTC",
      armed: accumulateArmed,
    },
    {
      id: "R-BTC-2",
      kind: "take_profit",
      condition: `BTC 30d change >= ${TAKE_PROFIT_RUN_PCT}%`,
      action: "take 25% of BTC position",
      armed: takeProfitArmed,
    },
    {
      id: "R-BTC-3",
      kind: "reduce_size",
      condition: `vol_index > ${REDUCE_SIZE_VOL_MIN}`,
      action: "reduce BTC exposure to 50% of target",
      armed: reduceSizeArmed,
    },
    {
      id: "R-BTC-4",
      kind: "hold",
      condition: "no accumulate/take_profit/reduce_size rule armed",
      action: "maintain current BTC exposure within mode bounds",
      armed: holdArmed,
    },
  ];

  const mining = computeMiningRevenue(inputs);
  const guardrails: BtcGuardrail[] = [
    buildVolatilityGuardrail(inputs.vol_index),
    buildMiningMarginGuardrail(mining.margin_score),
    buildConcentrationGuardrail(mode),
    buildLiquidityGuardrail(),
  ];

  const targetExposurePct = computeTargetExposure(
    mode,
    accumulateArmed,
    takeProfitArmed,
    reduceSizeArmed,
  );

  assertNoForbiddenWords(triggers, guardrails);

  return { triggers, guardrails, targetExposurePct };
}

function buildVolatilityGuardrail(volIndex: number): BtcGuardrail {
  const status: BtcGuardrail["status"] =
    volIndex > VOL_BREACHED
      ? "breached"
      : volIndex > VOL_WARNING
        ? "warning"
        : "normal";
  return {
    id: "G-BTC-VOL",
    kind: "volatility",
    label: "Volatility guardrail",
    status,
    detail: `vol_index=${volIndex} (warning > ${VOL_WARNING}, breached > ${VOL_BREACHED})`,
  };
}

function buildMiningMarginGuardrail(marginScore: number): BtcGuardrail {
  const status: BtcGuardrail["status"] =
    marginScore >= MARGIN_HEALTHY
      ? "healthy"
      : marginScore >= MARGIN_WARNING
        ? "warning"
        : "breached";
  return {
    id: "G-BTC-MARGIN",
    kind: "mining_margin",
    label: "Mining margin guardrail",
    status,
    detail: `margin_score=${marginScore} (warning [${MARGIN_WARNING}, ${MARGIN_HEALTHY}), healthy >= ${MARGIN_HEALTHY})`,
  };
}

function buildConcentrationGuardrail(mode: VaultMode): BtcGuardrail {
  const status: BtcGuardrail["status"] =
    mode === "opportunistic" ? "warning" : "normal";
  return {
    id: "G-BTC-CONC",
    kind: "concentration",
    label: "Concentration guardrail",
    status,
    detail: `vault_mode=${mode}; opportunistic mode raises BTC concentration exposure`,
  };
}

function buildLiquidityGuardrail(): BtcGuardrail {
  return {
    id: "G-BTC-LIQ",
    kind: "liquidity",
    label: "Liquidity guardrail",
    status: "normal",
    detail: "MVP placeholder; on-chain depth feed wired in V1",
  };
}

function computeTargetExposure(
  mode: VaultMode,
  accumulateArmed: boolean,
  takeProfitArmed: boolean,
  reduceSizeArmed: boolean,
): number {
  let target = BASE_TARGET_BY_MODE[mode];
  if (reduceSizeArmed) target *= REDUCE_SIZE_MULT;
  if (takeProfitArmed) target *= TAKE_PROFIT_MULT;
  if (accumulateArmed) target *= ACCUMULATE_MULT;
  const capped = Math.min(EXPOSURE_CAP_PCT, target);
  return Math.max(0, Math.round(capped));
}

function assertNoForbiddenWords(
  triggers: BtcTrigger[],
  guardrails: BtcGuardrail[],
): void {
  const lines: string[] = [];
  for (const t of triggers) {
    lines.push(t.condition, t.action);
  }
  for (const g of guardrails) {
    lines.push(g.label, g.detail);
  }
  for (const line of lines) {
    const hit = findForbiddenWord(line);
    if (hit !== null) {
      throw new Error(`forbidden word "${hit}" in btc tactical text: ${line}`);
    }
  }
}
