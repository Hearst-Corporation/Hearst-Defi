/**
 * mining-canvas-model.ts — the tested, pure computation behind the BTC Mining
 * Vault calculation debug canvas (docs/strategy/btc-mining-vault-calculation-canvas.html).
 *
 * Goal: ONE place where the canvas math lives, grounded in the REAL pipeline
 * functions wherever the logic is financially load-bearing or contested:
 *
 *   - allocation weights  → deriveRegimeAllocation / deriveRawAllocation (real)
 *   - raw vs adjusted APY → buildEconomicsViews (real)
 *   - product bands/targets → BTC_MINING_PERFORMANCE_VAULT (real constant)
 *   - regime base mix      → BASE_MIX_BY_MODE (real constant)
 *   - coverage classifier  → getCoverageState (real)
 *
 * The machine-economics layer (energy/capex/net/yield) is reproduced here from
 * cost-model.ts / strategy-model.ts so the canvas can recompute it client-side;
 * the formulas are shown verbatim in the canvas Formula Inspector and a test
 * pins them to the real cost-model output.
 *
 * STRICT: pure — no I/O, no Date.now(), no Math.random(), no server-only imports.
 * Nothing here writes, sends, deploys, or fetches. CONFIGURED is never VALIDATED.
 */

import { BTC_MINING_PERFORMANCE_VAULT } from "./btc-mining-performance-vault";
import { buildEconomicsViews, type EconomicsViews } from "./economics-views";
import { deriveRegimeAllocation } from "@/lib/agentic/swarm/live/strategy-allocation";
import { BASE_MIX_BY_MODE } from "@/lib/engine/rebalancing-rules";
import { getCoverageState, type CoverageState } from "@/lib/engine/coverage";
import type { VaultMode } from "@/lib/engine/types";

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export type CanvasProvenance =
  | "LIVE"
  | "ATTESTED"
  | "ESTIMATED"
  | "CONFIGURED"
  | "STALE"
  | "UNKNOWN";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface CanvasInputs {
  capitalUsd: number;
  btcPriceNow: number;
  hashpriceUsdPerThDay: number;
  machineModel: string;
  /** Letine cost price (prix de revient, before company markup), USD. */
  machinePriceUsd: number;
  machineHashrateTh: number;
  machineEfficiencyJTh: number;
  machineLifeMonths: number;
  energyCostUsdPerKwh: number;
  /** Uptime fraction 0..1. */
  uptime: number;
  poolFeePct: number;
  maintenanceFeePct: number;
  markupPct: number;
  revenueSharePct: number;
  borrowAprPct: number;
  stableYieldPct: number;
  btcYieldPct: number;
  avgLtv: number;
  liquidationThreshold: number;
  feesPct: number;
  btcBearPct: number;
  btcBasePct: number;
  btcBullPct: number;
}

/** Each input's provenance — CONFIGURED is set-in-code, never validated. */
export const INPUT_PROVENANCE: Record<keyof CanvasInputs, CanvasProvenance> = {
  capitalUsd: "CONFIGURED",
  btcPriceNow: "ESTIMATED", // LIVE in the pipeline (fetchBtcPrice); placeholder here
  hashpriceUsdPerThDay: "ESTIMATED", // LIVE in the pipeline (fetchHashprice)
  machineModel: "ESTIMATED", // ATTESTED in the pipeline (Telegram)
  machinePriceUsd: "ESTIMATED", // ATTESTED in the pipeline (Telegram)
  machineHashrateTh: "ESTIMATED",
  machineEfficiencyJTh: "ESTIMATED",
  machineLifeMonths: "CONFIGURED",
  energyCostUsdPerKwh: "CONFIGURED", // company lever (6¢/kWh)
  uptime: "CONFIGURED",
  poolFeePct: "CONFIGURED", // canvas-only opex (not in the pipeline cost model)
  maintenanceFeePct: "CONFIGURED", // canvas-only opex
  markupPct: "CONFIGURED",
  revenueSharePct: "CONFIGURED",
  borrowAprPct: "CONFIGURED",
  stableYieldPct: "ESTIMATED", // LIVE in the pipeline (DeFiLlama)
  btcYieldPct: "CONFIGURED", // optional, excess only
  avgLtv: "CONFIGURED",
  liquidationThreshold: "CONFIGURED",
  feesPct: "CONFIGURED",
  btcBearPct: "CONFIGURED",
  btcBasePct: "CONFIGURED",
  btcBullPct: "CONFIGURED",
};

const P = BTC_MINING_PERFORMANCE_VAULT;

/** Defaults sourced from the real constants (company-assumptions + product). */
export const DEFAULT_CANVAS_INPUTS: CanvasInputs = {
  capitalUsd: 1_000_000,
  btcPriceNow: 60_000, // the pipeline's own fallback when the live read is stale
  hashpriceUsdPerThDay: 0.06,
  machineModel: "Antminer S21 Pro (hydro)",
  machinePriceUsd: 3_500,
  machineHashrateTh: 234,
  machineEfficiencyJTh: 15,
  machineLifeMonths: 60,
  energyCostUsdPerKwh: P.levers.energyCostUsdPerKwh.value, // 0.06
  uptime: 0.98,
  poolFeePct: 1,
  maintenanceFeePct: 1,
  markupPct: P.levers.markupPct.value * 100, // 15
  revenueSharePct: P.levers.revenueSharePct.value * 100, // 20
  borrowAprPct: P.levers.borrowAprPct.value * 100, // 6
  stableYieldPct: 9,
  btcYieldPct: 0,
  avgLtv: P.levers.ltv.value.avg, // 0.5
  liquidationThreshold: P.levers.ltv.value.liquidation, // 0.825
  feesPct: 2,
  btcBearPct: P.levers.btcScenarios.value.bear * 100, // -20
  btcBasePct: P.levers.btcScenarios.value.base * 100, // 40
  btcBullPct: P.levers.btcScenarios.value.bull * 100, // 120
};

// ---------------------------------------------------------------------------
// Machine economics (reproduces cost-model.ts / strategy-model.ts)
// ---------------------------------------------------------------------------

const FREIGHT_USD_PER_UNIT = 100;
const DAYS_PER_MONTH = 30.4;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;

export interface MachineEconResult {
  exWorksUsd: number;
  landedPerMachineUsd: number;
  landedPerThUsd: number;
  capexUsdPerThDay: number;
  energyUsdPerThDay: number;
  poolMaintUsdPerThDay: number;
  totalCostUsdPerThDay: number;
  grossRevenueUsdPerThDay: number;
  netUsdPerThDay: number;
  companyCutUsdPerThDay: number;
  lpNetUsdPerThDay: number;
  lpMiningYieldPct: number;
  miningProfitable: boolean;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
function r6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Per-TH/day machine economics. Mirrors cost-model.ts (landed/capex/energy) +
 * strategy-model.ts (markup → net → revenue-share → LP yield), plus two
 * canvas-only opex levers (pool + maintenance) marked CONFIGURED. Pure.
 */
export function computeCanvasMachineEcon(i: CanvasInputs): MachineEconResult {
  const exWorks = i.machinePriceUsd * (1 + i.markupPct / 100);
  const landedPerMachine = exWorks + FREIGHT_USD_PER_UNIT;
  const th = i.machineHashrateTh > 0 ? i.machineHashrateTh : 1;
  const landedPerTh = landedPerMachine / th;

  const capex = landedPerMachine / th / (i.machineLifeMonths * DAYS_PER_MONTH);
  const kwhPerThDay = (i.machineEfficiencyJTh * HOURS_PER_DAY) / 1000;
  const energy = kwhPerThDay * i.energyCostUsdPerKwh * i.uptime;
  const poolMaint =
    i.hashpriceUsdPerThDay * ((i.poolFeePct + i.maintenanceFeePct) / 100);
  const totalCost = capex + energy + poolMaint;

  const gross = i.hashpriceUsdPerThDay;
  const net = gross - totalCost;
  const companyCut = Math.max(0, net) * (i.revenueSharePct / 100);
  const lpNet = net - companyCut;
  const lpYield = landedPerTh > 0 ? ((lpNet * DAYS_PER_YEAR) / landedPerTh) * 100 : 0;

  return {
    exWorksUsd: r2(exWorks),
    landedPerMachineUsd: r2(landedPerMachine),
    landedPerThUsd: r2(landedPerTh),
    capexUsdPerThDay: r6(capex),
    energyUsdPerThDay: r6(energy),
    poolMaintUsdPerThDay: r6(poolMaint),
    totalCostUsdPerThDay: r6(totalCost),
    grossRevenueUsdPerThDay: r6(gross),
    netUsdPerThDay: r6(net),
    companyCutUsdPerThDay: r6(companyCut),
    lpNetUsdPerThDay: r6(lpNet),
    lpMiningYieldPct: r2(lpYield),
    miningProfitable: net > 0,
  };
}

// ---------------------------------------------------------------------------
// Scenario (4-sleeve allocation + APY range + dispersion + coverage)
// ---------------------------------------------------------------------------

export type Regime = "defensive" | "balanced" | "opportunistic";

export interface CanvasScenario {
  regime: Regime;
  label: string;
  allocation: {
    mining: number;
    btcHolding: number;
    stableReserve: number;
    yieldOverlay: number;
  };
  miningFraction: number;
  governanceException: boolean;
  miningProfitable: boolean;
  btcReturnPct: number;
  borrowDragPct: number;
  apyLowPct: number;
  apyHighPct: number;
  apyBasePct: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  coverageRatio: number;
  coverageState: CoverageState;
  warnings: string[];
}

// Allocator risk proxies (from allocator.ts DEFAULT_RISK) for the dispersion band.
const RISK = { mining: 35, btc: 65, usdc: 3 } as const;
const Z90 = 1.645;
const Z50 = 0.674;

const REGIME_LABEL: Record<Regime, string> = {
  defensive: "Defensive",
  balanced: "Balanced",
  opportunistic: "Opportunistic",
};

function regimeBtcReturnPct(regime: Regime, i: CanvasInputs): number {
  if (regime === "defensive") return i.btcBearPct;
  if (regime === "opportunistic") return i.btcBullPct;
  return i.btcBasePct;
}

/**
 * Build one scenario. The 4-sleeve allocation comes from the REAL
 * deriveRegimeAllocation (30% mining floor enforced). The APY range reuses the
 * composeVaultApy formula on those canonical weights; the p5/p50/p95 band is an
 * analytic normal approximation (ESTIMATED) around the base APY — NOT the seeded
 * Monte-Carlo (which runs server-side). Pure.
 */
export function buildCanvasScenario(
  regime: Regime,
  i: CanvasInputs,
  miningYieldPct: number,
): CanvasScenario {
  const a = deriveRegimeAllocation({
    regime,
    miningYieldPct,
    usdcYieldPct: i.stableYieldPct,
  });

  const wMining = a.mining / 100;
  const wBtc = a.btc / 100;
  const wUsdc = (a.usdc + a.stableReserve) / 100;
  const borrowDrag = r2(i.borrowAprPct * i.avgLtv * wBtc);

  const apyAt = (btcRet: number) =>
    r2(
      wMining * miningYieldPct +
        wBtc * btcRet +
        wUsdc * i.stableYieldPct -
        borrowDrag -
        i.feesPct,
    );

  const bear = apyAt(i.btcBearPct);
  const base = apyAt(regimeBtcReturnPct(regime, i));
  const bull = apyAt(i.btcBullPct);
  const apyLow = Math.min(bear, bull);
  const apyHigh = Math.max(bear, bull);

  // Analytic dispersion (ESTIMATED): independent-leg normal approximation.
  const sigma = Math.sqrt(
    (wMining * RISK.mining) ** 2 +
      (wBtc * RISK.btc) ** 2 +
      (wUsdc * RISK.usdc) ** 2,
  );

  // Coverage = annual cash capacity (LP mining yield + stable yield on weights)
  // ÷ the monthly distribution target midpoint annualised. ESTIMATED proxy.
  const targetAnnualPct =
    ((P.monthlyDistributionTargetAnnualized.min +
      P.monthlyDistributionTargetAnnualized.max) /
      2) *
    100;
  const cashCapacityPct =
    wMining * Math.max(0, miningYieldPct) + wUsdc * Math.max(0, i.stableYieldPct);
  const coverageRatio =
    targetAnnualPct > 0 ? r2(cashCapacityPct / targetAnnualPct) : 0;

  const warnings: string[] = [];
  if (a.governanceException)
    warnings.push("Mining clamped to the 30% floor — governance review.");
  if (!a.miningProfitable)
    warnings.push("Mining underwater — rotated toward the stable floor.");
  if (base < 0)
    warnings.push("Base-case APY is negative — see the negative-driver panel.");

  return {
    regime,
    label: REGIME_LABEL[regime],
    allocation: {
      mining: a.mining,
      btcHolding: a.btc,
      stableReserve: a.stableReserve,
      yieldOverlay: a.usdc,
    },
    miningFraction: a.miningFraction,
    governanceException: a.governanceException,
    miningProfitable: a.miningProfitable,
    btcReturnPct: regimeBtcReturnPct(regime, i),
    borrowDragPct: borrowDrag,
    apyLowPct: apyLow,
    apyHighPct: apyHigh,
    apyBasePct: base,
    p5: r2(base - Z90 * sigma),
    p25: r2(base - Z50 * sigma),
    p50: r2(base),
    p75: r2(base + Z50 * sigma),
    p95: r2(base + Z90 * sigma),
    coverageRatio,
    coverageState: getCoverageState(coverageRatio),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Raw vs allocator-adjusted economics (negative-APY transparency)
// ---------------------------------------------------------------------------

export interface CanvasEconomics extends EconomicsViews {
  /** Human-readable explanation of WHY a figure is negative (empty if none). */
  negativeDrivers: string[];
}

/**
 * Raw (forced-mining at the regime base mix) vs allocator-adjusted (risk-derived,
 * floor-enforced) economics. Reuses the REAL buildEconomicsViews so the
 * bug-candidate logic matches the pipeline. Adds an explicit negative-driver list.
 */
export function buildCanvasEconomics(
  i: CanvasInputs,
  machine: MachineEconResult,
): CanvasEconomics {
  const miningYieldPct = machine.lpMiningYieldPct;
  // RAW = forced mining at the balanced base-mix weight (no risk rotation).
  const rawMiningWeight = BASE_MIX_BY_MODE.balanced.mining / 100;
  // ADJUSTED = the real allocator's floored balanced weight.
  const adjusted = deriveRegimeAllocation({
    regime: "balanced",
    miningYieldPct,
    usdcYieldPct: i.stableYieldPct,
  });

  const views = buildEconomicsViews({
    miningYieldPct,
    usdcYieldPct: i.stableYieldPct,
    btcBaseReturnPct: i.btcBasePct,
    borrowAprPct: i.borrowAprPct,
    feePct: i.feesPct,
    rawMiningWeight,
    adjustedMiningWeight: adjusted.miningFraction,
  });

  const negativeDrivers: string[] = [];
  if (machine.netUsdPerThDay <= 0) {
    negativeDrivers.push(
      `Mining net income is negative: gross revenue $${machine.grossRevenueUsdPerThDay}/TH/day < total cost $${machine.totalCostUsdPerThDay}/TH/day (energy $${machine.energyUsdPerThDay} + capex $${machine.capexUsdPerThDay} + pool/maint $${machine.poolMaintUsdPerThDay}).`,
    );
    negativeDrivers.push(
      "Allocator should rotate toward USDC when mining is unprofitable (mining held at the 30% floor for the BTC mining product).",
    );
  }
  if (views.raw.blendedApyPct < 0) {
    negativeDrivers.push(
      `Raw economics negative at forced mining weight ${views.raw.miningWeight}: mining ${views.raw.miningYieldPct}% drags the blend.`,
    );
  }
  if (views.bugCandidate) {
    negativeDrivers.push(
      "BUG CANDIDATE — allocator-adjusted APY is negative even though capital should rotate away from unprofitable mining. Inspect: mining weight derivation / floor enforcement / negative-yield treatment.",
    );
  }

  return { ...views, negativeDrivers };
}

// ---------------------------------------------------------------------------
// Construction steps (formula + values + output + provenance)
// ---------------------------------------------------------------------------

export interface CanvasStep {
  id: string;
  title: string;
  formula: string;
  inputs: Record<string, number | string>;
  output: string;
  provenance: CanvasProvenance;
  warning?: string;
}

export function buildCanvasSteps(
  i: CanvasInputs,
  m: MachineEconResult,
  balanced: CanvasScenario,
): CanvasStep[] {
  const steps: CanvasStep[] = [
    {
      id: "A",
      title: "Read machine offer",
      formula: "costPrice (Letine ex-works, prix de revient)",
      inputs: { machineModel: i.machineModel, machinePriceUsd: i.machinePriceUsd },
      output: `$${i.machinePriceUsd}`,
      provenance: INPUT_PROVENANCE.machinePriceUsd,
    },
    {
      id: "B",
      title: "Normalize machine cost (markup + landed)",
      formula: "landed = costPrice×(1+markup%) + freight($100)",
      inputs: { markupPct: i.markupPct, exWorksUsd: m.exWorksUsd },
      output: `landed $${m.landedPerMachineUsd} ($${m.landedPerThUsd}/TH)`,
      provenance: "CONFIGURED",
    },
    {
      id: "C",
      title: "Compute TH/s purchased",
      formula: "th = machineHashrateTh (per unit)",
      inputs: { machineHashrateTh: i.machineHashrateTh },
      output: `${i.machineHashrateTh} TH/s`,
      provenance: INPUT_PROVENANCE.machineHashrateTh,
    },
    {
      id: "D",
      title: "Compute gross mining revenue",
      formula: "gross = hashprice ($/TH/day)",
      inputs: { hashpriceUsdPerThDay: i.hashpriceUsdPerThDay },
      output: `$${m.grossRevenueUsdPerThDay}/TH/day`,
      provenance: INPUT_PROVENANCE.hashpriceUsdPerThDay,
    },
    {
      id: "E",
      title: "Subtract energy / capex / pool / maintenance",
      formula:
        "energy = (effJTh×24/1000)×$kWh×uptime ; capex = landed/TH/(lifeMo×30.4) ; poolMaint = hashprice×(pool%+maint%)",
      inputs: {
        energy: m.energyUsdPerThDay,
        capex: m.capexUsdPerThDay,
        poolMaint: m.poolMaintUsdPerThDay,
      },
      output: `total cost $${m.totalCostUsdPerThDay}/TH/day`,
      provenance: "CONFIGURED",
    },
    {
      id: "F",
      title: "Apply operator revenue-share",
      formula: "companyCut = max(0,net)×revShare% ; lpNet = net − companyCut",
      inputs: {
        net: m.netUsdPerThDay,
        revenueSharePct: i.revenueSharePct,
        companyCut: m.companyCutUsdPerThDay,
      },
      output: `LP net $${m.lpNetUsdPerThDay}/TH/day`,
      provenance: "CONFIGURED",
      ...(m.netUsdPerThDay <= 0
        ? { warning: "Net mining income ≤ 0 — mining is underwater." }
        : {}),
    },
    {
      id: "G",
      title: "Compute net mining income (LP yield)",
      formula: "lpYield% = (lpNet×365)/landedPerTh×100",
      inputs: { lpNet: m.lpNetUsdPerThDay, landedPerTh: m.landedPerThUsd },
      output: `${m.lpMiningYieldPct}%`,
      provenance: "ESTIMATED",
      ...(m.lpMiningYieldPct < 0
        ? { warning: "Mining yield negative — allocator must rotate to USDC." }
        : {}),
    },
    {
      id: "H",
      title: "Compare mining vs stable yield vs BTC upside",
      formula: "score = max(0,return)/risk (mining 35, btc 65, usdc 3)",
      inputs: {
        miningYieldPct: m.lpMiningYieldPct,
        stableYieldPct: i.stableYieldPct,
        btcBasePct: i.btcBasePct,
      },
      output: "scores drive risk-adjusted weights",
      provenance: "CONFIGURED",
    },
    {
      id: "I",
      title: "Derive allocation weights (balanced, floor enforced)",
      formula:
        "deriveRegimeAllocation → mining clamped ≥ 30% ; usdc split into base + reserve",
      inputs: {
        mining: balanced.allocation.mining,
        btcHolding: balanced.allocation.btcHolding,
        stableReserve: balanced.allocation.stableReserve,
        yieldOverlay: balanced.allocation.yieldOverlay,
      },
      output: `mining ${balanced.allocation.mining}% · BTC ${balanced.allocation.btcHolding}% · reserve ${balanced.allocation.stableReserve}% · overlay ${balanced.allocation.yieldOverlay}%`,
      provenance: "CONFIGURED",
      ...(balanced.governanceException
        ? { warning: "Mining clamped to 30% floor (governance exception)." }
        : {}),
    },
    {
      id: "J",
      title: "Compute APY range",
      formula:
        "apy(btcRet) = wMining×mining + wBtc×btcRet + wUsdc×usdc − borrowDrag − fees ; range = [bear, bull]",
      inputs: {
        borrowDragPct: balanced.borrowDragPct,
        feesPct: i.feesPct,
        base: balanced.apyBasePct,
      },
      output: `${balanced.apyLowPct}% – ${balanced.apyHighPct}% (base ${balanced.apyBasePct}%)`,
      provenance: "ESTIMATED",
      ...(balanced.apyBasePct < 0
        ? { warning: "Base APY negative — inspect the negative-driver panel." }
        : {}),
    },
    {
      id: "K",
      title: "Compute coverage",
      formula:
        "coverage = (wMining×miningYield + wUsdc×stableYield) ÷ target distribution midpoint",
      inputs: { coverageRatio: balanced.coverageRatio },
      output: `${balanced.coverageRatio}× (${balanced.coverageState})`,
      provenance: "ESTIMATED",
      ...(balanced.coverageState === "suspended" ||
      balanced.coverageState === "stressed"
        ? { warning: "Coverage below adequate — distribution gate would pause." }
        : {}),
    },
    {
      id: "L",
      title: "Decide funding source",
      formula:
        "cheapest idle stable → borrow vs stable yield → reserve (preserve floor) ; BTC sale last resort",
      inputs: { borrowAprPct: i.borrowAprPct, stableYieldPct: i.stableYieldPct },
      output:
        i.borrowAprPct < i.stableYieldPct
          ? "Borrow against BTC (cheaper than the stable yield it preserves)"
          : "Use idle stable / reserve (borrow not advantageous)",
      provenance: "CONFIGURED",
    },
    {
      id: "M",
      title: "Decide early exit / recovery",
      formula:
        "coverage < 1.0 → pause distribution ; < 0.8 → suspend ; maturity unrecovered → capital-only recovery extension",
      inputs: {
        recoveryMinMonths: P.recovery.extensionMonths.min,
        recoveryMaxMonths: P.recovery.extensionMonths.max,
      },
      output: `Recovery ${P.recovery.extensionMonths.min}–${P.recovery.extensionMonths.max} mo, capital-only (not a guarantee)`,
      provenance: "CONFIGURED",
    },
  ];
  return steps;
}

// ---------------------------------------------------------------------------
// Full model + export
// ---------------------------------------------------------------------------

export interface CanvasModel {
  inputs: CanvasInputs;
  machine: MachineEconResult;
  economics: CanvasEconomics;
  scenarios: CanvasScenario[];
  steps: CanvasStep[];
  warnings: string[];
  bugCandidates: string[];
}

export function buildCanvasModel(
  inputs: CanvasInputs = DEFAULT_CANVAS_INPUTS,
): CanvasModel {
  const machine = computeCanvasMachineEcon(inputs);
  const miningYieldPct = machine.lpMiningYieldPct;
  const scenarios = (["defensive", "balanced", "opportunistic"] as const).map(
    (r) => buildCanvasScenario(r, inputs, miningYieldPct),
  );
  const balanced = scenarios.find((s) => s.regime === "balanced")!;
  const economics = buildCanvasEconomics(inputs, machine);
  const steps = buildCanvasSteps(inputs, machine, balanced);

  const warnings = [...new Set(scenarios.flatMap((s) => s.warnings))];
  const bugCandidates: string[] = [];
  if (economics.bugCandidate) {
    bugCandidates.push(
      "Allocator-adjusted APY negative despite positive stable fallback.",
    );
  }

  return { inputs, machine, economics, scenarios, steps, warnings, bugCandidates };
}

/** Serializable export of the canvas state. Pure — no I/O. */
export function buildCanvasExport(
  inputs: CanvasInputs = DEFAULT_CANVAS_INPUTS,
): {
  inputs: CanvasInputs;
  outputs: MachineEconResult;
  economics: { rawApyPct: number; adjustedApyPct: number; bugCandidate: boolean };
  scenarios: CanvasScenario[];
  warnings: string[];
  bugCandidates: string[];
} {
  const m = buildCanvasModel(inputs);
  return {
    inputs: m.inputs,
    outputs: m.machine,
    economics: {
      rawApyPct: m.economics.raw.blendedApyPct,
      adjustedApyPct: m.economics.adjusted.blendedApyPct,
      bugCandidate: m.economics.bugCandidate,
    },
    scenarios: m.scenarios,
    warnings: m.warnings,
    bugCandidates: m.bugCandidates,
  };
}

export type { VaultMode };
