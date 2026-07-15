import "server-only";

// Test fixture: a representative `InvestorMemoInput` used by the investor-memo
// PDF template snapshot test. The production input is assembled by the
// Prisma-backed loaders in `src/lib/agents/loaders/*`; this fixture exists
// solely to exercise the PDF rendering layer deterministically. Keep the shape
// aligned with InvestorMemoInput (src/lib/agents/investor-memo.ts).
//
// v2 alignment: allocations are the three PermissionedDynaVault v2.1 pockets
// mapped onto the existing engine bucket keys (mining -> B1 Mining Power,
// btc_tactical -> B2 BTC Pouch, usdc_base -> B3 Reserve USDC). The base
// (balanced) scenario carries the canonical 40 / 27 / 33 target bands; other
// modes tilt within those bands. `yield_contribution_bps` is 0: the v2 note
// accumulates BTC over its term with rule-based take-profit and pays no
// per-pocket periodic yield.

import type { InvestorMemoInput } from "@/lib/agents/investor-memo";
import type {
  BacktestOutput,
  BtcTacticalAssessment,
  ScenarioOutput,
} from "@/lib/engine/types";

const btcAssessment: BtcTacticalAssessment = {
  targetExposurePct: 27,
  triggers: [
    {
      id: "acc-t1",
      kind: "accumulate",
      condition: "BTC < $75,344 (−20% from 90d ATH)",
      action: "convert 5% of capital (USDC → BTC) into the BTC Pouch (R-BTC-1)",
      armed: true,
    },
    {
      id: "tp-t1",
      kind: "take_profit",
      condition: "BTC > $113,946 (entry × 1.30)",
      action: "sell 25% of the BTC Pouch (R-BTC-3)",
      armed: true,
    },
  ],
  guardrails: [
    {
      id: "vol-guard",
      kind: "volatility",
      label: "Volatility guardrail",
      status: "normal",
      detail: "30d realised vol 42% (threshold 90%)",
    },
    {
      id: "margin-guard",
      kind: "mining_margin",
      label: "Mining margin guardrail",
      status: "healthy",
      detail: "Margin score 72 — accumulation enabled",
    },
  ],
};

const baseScenario: ScenarioOutput = {
  apy_range: { low: 9.4, high: 12.8 },
  stressed_apy: 6.1,
  risk_score: 42,
  mining_margin_score: 72,
  mode: "balanced",
  confidence: "medium",
  allocations: [
    { bucket: "mining", pct: 40, yield_contribution_bps: 0 },
    { bucket: "btc_tactical", pct: 27, yield_contribution_bps: 0 },
    { bucket: "usdc_base", pct: 33, yield_contribution_bps: 0 },
  ],
  assumptions: [
    "methodology_version=v1.0",
    "preset=base; vault_mode=balanced; uptime=98% (paper phase)",
    "hashprice=0.085 USD/TH/day, energy=0.045 USD/kWh",
    "btc_price_change_30d=0%, vol_index=2.0, stable_base_apy=4.5%",
    "Outputs are projections, not guaranteed. Past performance does not predict future results.",
  ],
  btc_tactical: btcAssessment,
};

const bearScenario: ScenarioOutput = {
  apy_range: { low: 5.2, high: 7.6 },
  stressed_apy: 3.4,
  risk_score: 58,
  mining_margin_score: 51,
  mode: "defensive",
  confidence: "medium",
  allocations: [
    { bucket: "mining", pct: 34, yield_contribution_bps: 0 },
    { bucket: "btc_tactical", pct: 18, yield_contribution_bps: 0 },
    { bucket: "usdc_base", pct: 48, yield_contribution_bps: 0 },
  ],
  assumptions: [
    "methodology_version=v1.0",
    "preset=btc_bear; vault_mode=defensive",
    "hashprice=0.060 USD/TH/day, energy=0.047 USD/kWh, uptime=97%",
    "btc_price_change_30d=-40%, vol_index=2.5, stable_base_apy=4.5%",
    "Outputs are projections, not guaranteed.",
  ],
  btc_tactical: btcAssessment,
};

const miningCompression: ScenarioOutput = {
  apy_range: { low: 6.4, high: 9.1 },
  stressed_apy: 4.0,
  risk_score: 53,
  mining_margin_score: 47,
  mode: "defensive",
  confidence: "medium",
  allocations: [
    { bucket: "mining", pct: 30, yield_contribution_bps: 0 },
    { bucket: "btc_tactical", pct: 20, yield_contribution_bps: 0 },
    { bucket: "usdc_base", pct: 50, yield_contribution_bps: 0 },
  ],
  assumptions: [
    "methodology_version=v1.0",
    "preset=mining_compression; vault_mode=defensive",
    "difficulty+30%, hashprice=0.064 USD/TH/day, energy=0.052 USD/kWh",
    "btc_price_change_30d=0%, vol_index=2.0",
    "Outputs are projections, not guaranteed.",
  ],
  btc_tactical: btcAssessment,
};

const bullScenario: ScenarioOutput = {
  apy_range: { low: 11.6, high: 15.2 },
  stressed_apy: 7.8,
  risk_score: 38,
  mining_margin_score: 81,
  mode: "opportunistic",
  confidence: "high",
  allocations: [
    { bucket: "mining", pct: 44, yield_contribution_bps: 0 },
    { bucket: "btc_tactical", pct: 34, yield_contribution_bps: 0 },
    { bucket: "usdc_base", pct: 22, yield_contribution_bps: 0 },
  ],
  assumptions: [
    "methodology_version=v1.0",
    "preset=btc_bull; vault_mode=opportunistic",
    "hashprice=0.102 USD/TH/day, energy=0.045 USD/kWh",
    "btc_price_change_30d=+60%, vol_index=3.0, stable_base_apy=4.5%",
    "Outputs are projections, not guaranteed.",
  ],
  btc_tactical: btcAssessment,
};

const extremeStress: ScenarioOutput = {
  apy_range: { low: 2.1, high: 4.3 },
  stressed_apy: 1.2,
  risk_score: 71,
  mining_margin_score: 38,
  mode: "defensive",
  confidence: "low",
  allocations: [
    { bucket: "mining", pct: 24, yield_contribution_bps: 0 },
    { bucket: "btc_tactical", pct: 12, yield_contribution_bps: 0 },
    { bucket: "usdc_base", pct: 64, yield_contribution_bps: 0 },
  ],
  assumptions: [
    "methodology_version=v1.0",
    "preset=extreme_stress; vault_mode=defensive",
    "BTC −50%, hashprice=0.051 USD/TH/day, DeFi shock active",
    "stablecoin depeg episode ~50bps, vol_index=3.0",
    "Outputs are projections, not guaranteed.",
  ],
  btc_tactical: btcAssessment,
};

function monthlySeries(
  initial: number,
  monthlyReturnPct: number,
  months: number,
): InvestorMemoInput["backtests"][number]["monthlySeries"] {
  const out: InvestorMemoInput["backtests"][number]["monthlySeries"] = [];
  let value = initial;
  for (let i = 0; i < months; i += 1) {
    value = value * (1 + monthlyReturnPct / 100);
    out.push({
      month: `2026-${String(((i % 12) + 1)).padStart(2, "0")}`,
      valueUsdc: Math.round(value),
      distributionUsdc: Math.round(value * 0.008),
    });
  }
  return out;
}

const bearBacktest: BacktestOutput = {
  key: "bear_2022",
  startDate: "2022-01-01",
  endDate: "2023-12-31",
  initialCapital: 10_000_000,
  endingValue: 10_540_000,
  totalReturnPct: 5.4,
  maxDrawdownPct: -7.2,
  worstMonthPct: -2.1,
  numRebalances: 8,
  monthlySeries: monthlySeries(10_000_000, 0.22, 24),
  hearstRulesMode: true,
  assumptions: [
    "Backtest applies Hearst rules in defensive-leaning regime.",
    "Mining margin assumed paper attestation freshness 24h.",
    "Hashprice and difficulty are historical, not forecast.",
  ],
};

const etfHalving: BacktestOutput = {
  key: "etf_halving_2024",
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  initialCapital: 10_000_000,
  endingValue: 11_280_000,
  totalReturnPct: 12.8,
  maxDrawdownPct: -4.5,
  worstMonthPct: -1.4,
  numRebalances: 5,
  monthlySeries: monthlySeries(10_000_000, 1.0, 12),
  hearstRulesMode: true,
  assumptions: [
    "Hearst rules R3 triggered twice during BTC momentum window.",
    "Mining yield boosted by hashprice rally post-halving.",
    "Reserve floor maintained at 14% per regime bounds.",
  ],
};

const miningCrunch: BacktestOutput = {
  key: "mining_crunch_2024",
  startDate: "2024-04-01",
  endDate: "2024-10-31",
  initialCapital: 10_000_000,
  endingValue: 10_180_000,
  totalReturnPct: 1.8,
  maxDrawdownPct: -3.1,
  worstMonthPct: -1.0,
  numRebalances: 6,
  monthlySeries: monthlySeries(10_000_000, 0.25, 7),
  hearstRulesMode: true,
  assumptions: [
    "Hashprice compression triggered R2 then R4 sequentially.",
    "Stable reserve absorbed mining yield drag.",
    "BTC Pouch held below 12% of capital throughout.",
  ],
};

export function getMockMemoInput(): InvestorMemoInput {
  return {
    vault: {
      aumUsdc: 24_600_000,
      apyRange: { low: 9.4, high: 12.8 },
      mode: "balanced",
      riskScore: 42,
    },
    scenarios: [
      baseScenario,
      bearScenario,
      miningCompression,
      bullScenario,
      extremeStress,
    ],
    backtests: [bearBacktest, etfHalving, miningCrunch],
    generatedAt: new Date().toISOString(),
  };
}
