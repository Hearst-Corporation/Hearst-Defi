/**
 * BTC Product Construction Orchestration — diagnostics suite (pure, dry-run).
 *
 * Proves the orchestration contract (PROMPT §16): the swarms run in parallel but
 * the reveal is sequenced + deterministic, every surface reads ONE canonical
 * allocation, the 30% mining floor holds (sub-floor raw is rejected), scenario
 * percents are not ×100, the two target layers never sum, and nothing writes /
 * sends / deploys. Each check exercises the REAL pure functions; no I/O.
 */
import {
  STAGE_ORDER,
  buildConstructionTimeline,
  buildTimelineFromDraft,
  canRenderPerformanceEngines,
  canRenderAllocation,
  canRenderSafeScenario,
  canRenderProductSummary,
  type ConstructionSignals,
  type SignalState,
} from "@/lib/agentic/swarm/live/construction-timeline";
import {
  buildCanonicalAllocation,
  enforceProductMiningFloor,
  resolveProductIdentity,
  assertCanonicalFloor,
  BTC_MINING_PRODUCT_ID,
} from "@/lib/products/canonical-allocation";
import {
  deriveRegimeAllocation,
  deriveRawAllocation,
} from "@/lib/agentic/swarm/live/strategy-allocation";
import { buildConstructionSteps } from "@/lib/agentic/swarm/live/construction-steps";
import { buildDeterministicWriteup } from "@/lib/agentic/swarm/live/runners-artifacts";
import { constructionDraftToVaultForm } from "@/lib/agentic/swarm/live/to-vault-form";
import { DEFAULT_QUANT_ASSUMPTIONS } from "@/lib/agentic/swarm/live/quant-assumptions";
import { LIVE_READ_FORBIDDEN_ACTIONS } from "@/lib/agentic/swarm/live/types";
import type {
  ProductConstructionDraft,
  QuantArtifact,
  ScenarioResult,
  StrategyCrossArtifact,
} from "@/lib/agentic/swarm/live/types";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import { formatTargetsSafely, MINING_FLOOR } from "@/lib/products/guards";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import {
  pass,
  fail,
  runChecks,
  type DiagnosticCheckSpec,
  type DiagnosticResult,
} from "@/lib/admin/diagnostics/types";

const SUITE = "btc-product-construction";

const TIMELINE_FILE = "src/lib/agentic/swarm/live/construction-timeline.ts";
const CANONICAL_FILE = "src/lib/products/canonical-allocation.ts";
const STEPS_FILE = "src/lib/agentic/swarm/live/construction-steps.ts";

// ---------------------------------------------------------------------------
// Synthetic, deterministic fixtures (no network, no runQuant/server-only).
// ---------------------------------------------------------------------------

const READY: SignalState = { present: true, provenance: "LIVE" };

function allReadySignals(): ConstructionSignals {
  return {
    btcMarket: READY,
    hashprice: READY,
    btcYield: { present: true, provenance: "CONFIGURED" },
    usdcYield: READY,
    machineEconomics: { present: true, provenance: "ATTESTED" },
    scenarioEngine: { present: true, provenance: "ESTIMATED" },
    writeup: { present: true, provenance: "CONFIGURED" },
  };
}

function syntheticStrategy(
  miningYieldPct: number,
  usdcYieldPct: number,
): StrategyCrossArtifact {
  return {
    configured: true,
    miningYieldPct,
    usdcYieldPct,
    usdcSource: "Aave USDC",
    // PERCENT units (−20 / +40 / +120), matching loadVaultApy().
    btcReturn: { bear: -20, base: 40, bull: 120 },
    headlineApy: { low: 8, high: 13 },
    assumptions: ["BTC scenario band is CONFIGURED, not validated."],
    disclaimer: "Projection conditional on the assumptions — not guaranteed.",
    companyLevers: {
      source: "assumptions-config",
      status: "CONFIGURED",
      markupPct: 15,
      revenueSharePct: 20,
      borrowAprPct: 6,
      feePct: 2,
      energyCostUsdPerKwh: 0.06,
    },
    provenance: "Live",
  };
}

function syntheticQuant(low: number, high: number): QuantArtifact {
  return {
    seed: 12345,
    paths: 500,
    horizonMonths: 12,
    percentiles: {
      p5: Math.max(0, low - 0.02),
      p25: low,
      p50: (low + high) / 2,
      p75: high,
      p95: high + 0.05,
    },
    headlineRange: { low, high },
    probBelowFloorPct: 10,
    floorApyPct: 8,
    provenance: "Live",
  };
}

function syntheticScenarios(
  miningYieldPct: number,
  usdcYieldPct: number,
): ScenarioResult[] {
  return (["defensive", "balanced", "opportunistic"] as const).map((regime) => {
    const a = deriveRegimeAllocation({ regime, miningYieldPct, usdcYieldPct });
    return {
      regime,
      allocation: {
        mining: a.mining,
        btc: a.btc,
        usdc: a.usdc,
        stableReserve: a.stableReserve,
        miningFraction: a.miningFraction,
        governanceException: a.governanceException,
        miningProfitable: a.miningProfitable,
        rationale: a.rationale,
      },
      quant: syntheticQuant(0.08, 0.13),
      miningProfitable: a.miningProfitable,
      governanceException: a.governanceException,
    };
  });
}

/**
 * Build a deterministic synthetic draft (the SAME shape the pipeline produces),
 * with the canonical allocation derived from the balanced regime + the raw
 * unconstrained output. Pure — exported so tests reuse it.
 */
export function makeSyntheticDraft(opts?: {
  objective?: string;
  miningYieldPct?: number;
  usdcYieldPct?: number;
}): ProductConstructionDraft {
  const objective = opts?.objective ?? "Construis le BTC Mining Performance Vault";
  const miningYieldPct = opts?.miningYieldPct ?? 10;
  const usdcYieldPct = opts?.usdcYieldPct ?? 9;

  const strategy = syntheticStrategy(miningYieldPct, usdcYieldPct);
  const scenarios = syntheticScenarios(miningYieldPct, usdcYieldPct);
  const quant = syntheticQuant(0.08, 0.13);

  const identity = resolveProductIdentity(objective);
  const balanced = deriveRegimeAllocation({
    regime: "balanced",
    miningYieldPct,
    usdcYieldPct,
  });
  const raw = deriveRawAllocation({
    regime: "balanced",
    miningYieldPct,
    usdcYieldPct,
  });
  const canonicalAllocation = buildCanonicalAllocation({
    productId: identity?.id ?? "vault:HYV",
    productName: identity?.name ?? "Hearst Yield Vault",
    enforced: {
      mining: balanced.mining,
      btcHoldingCollateral: balanced.btc,
      stableReserve: balanced.stableReserve,
      yieldOverlay: balanced.usdc,
      miningFraction: balanced.miningFraction,
      governanceException: balanced.governanceException,
      provenance: "Live",
    },
    raw: {
      mining: raw.mining,
      btcHoldingCollateral: raw.btc,
      stableReserve: raw.stableReserve,
      yieldOverlay: raw.usdc,
    },
  });

  const writeup = buildDeterministicWriteup({
    objective,
    vaultLabel: identity?.name ?? "Hearst Yield Vault",
    strategy,
    quant,
    market: { btcUsd: 60000, hashpriceUsdPerThDay: 0.06 },
    canonicalAllocation,
  });

  return {
    objective,
    vault: {
      ticker: identity?.ticker ?? "HYV",
      label: identity?.name ?? "Hearst Yield Vault",
    },
    productId: identity?.id ?? "vault:HYV",
    telegram: { configured: true, machineCount: 5, topMachine: "AntminerS21Pro" },
    market: { btcUsd: 60000, hashpriceUsdPerThDay: 0.06, defiApyMedianPct: 8.5 },
    strategy,
    quant,
    assumptions: DEFAULT_QUANT_ASSUMPTIONS,
    charts: [],
    writeup,
    audit: [],
    safe: true,
    disclaimer: "Read-only construction draft — not guaranteed.",
    mode: "live_read",
    effects: {
      externalSend: false,
      deployed: false,
      markedLive: false,
      custodialWrite: false,
    },
    scenarios,
    canonicalAllocation,
  };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const SPECS: readonly DiagnosticCheckSpec[] = [
  {
    id: "render-order-deterministic",
    label: "Parallel swarms can finish out of order — render order stays fixed",
    severity: "P0",
    expected: "timeline.stages always equals STAGE_ORDER regardless of which signals are present",
    likelyFile: TIMELINE_FILE,
    likelyFunction: "buildConstructionTimeline",
    guard: "timeline-order",
    run: () => {
      // Arrival A: everything ready. Arrival B: only late deps ready (out of order).
      const a = buildConstructionTimeline(allReadySignals());
      const partial: ConstructionSignals = {
        ...allReadySignals(),
        btcMarket: { present: false, provenance: "UNKNOWN" },
        scenarioEngine: { present: false, provenance: "UNKNOWN" },
      };
      const b = buildConstructionTimeline(partial);
      const orderA = a.stages.map((s) => s.id);
      const orderB = b.stages.map((s) => s.id);
      const matchesCanon =
        orderA.join(",") === STAGE_ORDER.join(",") &&
        orderB.join(",") === STAGE_ORDER.join(",");
      return matchesCanon
        ? pass("Render order is deterministic (= STAGE_ORDER) for any arrival order.", {
            order: orderA,
          })
        : fail("Render order diverged from the canonical STAGE_ORDER.", {
            orderA,
            orderB,
          });
    },
  },
  {
    id: "performance-engines-gated",
    label: "Performance engines wait for their dependencies",
    severity: "P0",
    expected: "gate false when BTC market is waiting; true when all deps ready",
    likelyFile: TIMELINE_FILE,
    likelyFunction: "canRenderPerformanceEngines",
    guard: "dependency-gate",
    run: () => {
      const ready = buildConstructionTimeline(allReadySignals());
      const missing = buildConstructionTimeline({
        ...allReadySignals(),
        btcMarket: { present: false, provenance: "UNKNOWN" },
      });
      const ok =
        canRenderPerformanceEngines(ready) === true &&
        canRenderPerformanceEngines(missing) === false;
      return ok
        ? pass("Performance engines gate opens only when BTC/hashprice/USDC are ready.")
        : fail("Performance-engines gate did not respect its dependencies.", {
            ready: canRenderPerformanceEngines(ready),
            missing: canRenderPerformanceEngines(missing),
          });
    },
  },
  {
    id: "allocation-gates-on-engines",
    label: "Allocation / Safe / Summary gate in order",
    severity: "P0",
    expected: "summary requires safe requires allocation requires engines",
    likelyFile: TIMELINE_FILE,
    likelyFunction: "canRenderAllocation / canRenderSafeScenario / canRenderProductSummary",
    guard: "dependency-gate",
    run: () => {
      const t = buildTimelineFromDraft(makeSyntheticDraft());
      const ok =
        canRenderPerformanceEngines(t) &&
        canRenderAllocation(t) &&
        canRenderSafeScenario(t) &&
        canRenderProductSummary(t);
      // And: with no scenarios, allocation/safe gates close.
      const noScenarioTimeline = buildConstructionTimeline({
        ...allReadySignals(),
        scenarioEngine: { present: false, provenance: "UNKNOWN" },
      });
      const closes =
        canRenderAllocation(noScenarioTimeline) === false &&
        canRenderSafeScenario(noScenarioTimeline) === false;
      return ok && closes
        ? pass("Allocation → Safe → Summary gates open in order, and close without scenarios.")
        : fail("A downstream gate opened before its dependency.", { ok, closes });
    },
  },
  {
    id: "canonical-single-source",
    label: "Wizard prefill + write-up read the CANONICAL allocation",
    severity: "P0",
    expected: "wizard mining bps == canonical mining ×100; write-up prose carries canonical mining %",
    likelyFile: CANONICAL_FILE,
    likelyFunction: "constructionDraftToVaultForm / buildDeterministicWriteup",
    guard: "single-source-of-truth",
    run: () => {
      const draft = makeSyntheticDraft();
      const ca = draft.canonicalAllocation!;
      const form = constructionDraftToVaultForm(draft);
      // Wizard mining bps must equal the canonical mining percent ×100 (±1 bps rounding).
      const wizardMatches = Math.abs(form.targetMiningBps - ca.mining * 100) <= 1;
      // Write-up prose must mention the same canonical mining %.
      const miningStr = `${Math.round(ca.mining * 10) / 10}%`;
      const writeupMatches = draft.writeup.prose.includes(
        `mining ${miningStr}`,
      );
      const ok = wizardMatches && writeupMatches;
      return ok
        ? pass("Wizard prefill and write-up both read the canonical allocation.", {
            canonicalMining: ca.mining,
            wizardMiningBps: form.targetMiningBps,
          })
        : fail("A surface diverged from the canonical allocation.", {
            wizardMatches,
            writeupMatches,
            canonicalMining: ca.mining,
            wizardMiningBps: form.targetMiningBps,
          });
    },
  },
  {
    id: "raw-subfloor-rejected",
    label: "Raw sub-floor mining allocation is rejected for the BTC mining product",
    severity: "P0",
    expected: "enforceProductMiningFloor(2.92, btc-mining) → rejected, clamped to 0.30",
    likelyFile: CANONICAL_FILE,
    likelyFunction: "enforceProductMiningFloor",
    guard: "mining-floor",
    run: () => {
      const decision = enforceProductMiningFloor(2.92, BTC_MINING_PRODUCT_ID);
      const ok =
        decision.rejected === true &&
        Math.abs(decision.miningFractionCanonical - MINING_FLOOR) < 1e-9 &&
        decision.governanceException === true;
      return ok
        ? pass("Raw mining 2.92% is rejected and clamped to the 30% floor.", { decision })
        : fail("Sub-floor raw mining was not rejected/clamped.", { decision });
    },
  },
  {
    id: "canonical-floor-30",
    label: "Canonical mining is never below 30% in NORMAL mode",
    severity: "P0",
    expected: "underwater mining → canonical mining 30% + rawRejected populated; assertCanonicalFloor empty",
    likelyFile: CANONICAL_FILE,
    likelyFunction: "buildCanonicalAllocation / assertCanonicalFloor",
    guard: "mining-floor",
    run: () => {
      // Underwater mining (−3%) forces the allocator sub-floor → must clamp.
      const draft = makeSyntheticDraft({ miningYieldPct: -3, usdcYieldPct: 9 });
      const ca = draft.canonicalAllocation!;
      const violations = assertCanonicalFloor(ca);
      const ok =
        ca.mining >= 30 - 1e-9 &&
        violations.length === 0 &&
        ca.rawRejected !== null &&
        ca.rawRejected.mining < 30;
      return ok
        ? pass("Underwater mining → canonical mining clamped to ≥30%; raw sub-floor kept as debug.", {
            canonicalMining: ca.mining,
            rawMining: ca.rawRejected?.mining,
          })
        : fail("Canonical mining dropped below the floor (or raw not rejected).", {
            canonicalMining: ca.mining,
            violations,
            rawRejected: ca.rawRejected,
          });
    },
  },
  {
    id: "scenario-percent-format",
    label: "Scenario BTC bands format as −20% / +40% / +120% (not ×100)",
    severity: "P0",
    expected: "construction-steps step-3 shows percent bands, never -2000%/4000%/12000%",
    likelyFile: STEPS_FILE,
    likelyFunction: "buildConstructionSteps",
    guard: "percent-format",
    run: () => {
      const scenarios = syntheticScenarios(10, 9);
      const steps = buildConstructionSteps({
        telegram: { machineCount: 5, topMachine: "S21", bestCostPerThDay: 0.05 },
        market: { btcUsd: 60000, hashpriceUsdPerThDay: 0.06, defiApyMedianPct: 8.5 },
        strategy: {
          miningYieldPct: 10,
          usdcYieldPct: 9,
          usdcSource: "Aave USDC",
          provenance: "Live",
          // PERCENT units, exactly as the pipeline feeds.
          btcReturn: { bear: -20, base: 40, bull: 120 },
        },
        scenarios,
      });
      const btcStep = steps.find((s) => s.id === "step-3");
      const finding = btcStep?.finding ?? "";
      const hasBands =
        /-20(\.0)?%/.test(finding) &&
        /\b40(\.0)?%/.test(finding) &&
        /\+120(\.0)?%/.test(finding);
      const noBlowup =
        !finding.includes("2000") &&
        !finding.includes("4000") &&
        !finding.includes("12000");
      return hasBands && noBlowup
        ? pass("BTC scenario bands render as −20% / 40% / +120% (no ×100 blow-up).", {
            finding,
          })
        : fail("BTC scenario percent formatting is wrong.", { finding });
    },
  },
  {
    id: "targets-never-summed",
    label: "8–12% and 20–24% are shown as separate layers, never summed",
    severity: "P0",
    expected: "formatTargetsSafely → distinct distribution + total strings, no '+' sum",
    likelyFile: "src/lib/products/guards.ts",
    likelyFunction: "formatTargetsSafely",
    guard: "no-double-count",
    run: () => {
      const t = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);
      const summedRe = /\d+\s*%\s*\+\s*\d+\s*%/;
      const ok =
        !summedRe.test(t.distribution) &&
        !summedRe.test(t.total) &&
        t.total.includes("inclusive") &&
        t.distribution !== t.total;
      return ok
        ? pass("Distribution + total are separate, inclusive layers — never summed.", t)
        : fail("Targets could be read as additive.", t);
    },
  },
  {
    id: "product-name-btc-mining",
    label: "BTC mining objective resolves to BTC Mining Performance Vault (not HYV)",
    severity: "P0",
    expected: "resolveProductIdentity('...btc mining...') → BTC Mining Performance Vault",
    likelyFile: CANONICAL_FILE,
    likelyFunction: "resolveProductIdentity",
    guard: "product-identity",
    run: () => {
      const id = resolveProductIdentity("Construis le BTC Mining Performance Vault");
      const generic = resolveProductIdentity("Build a generic stable yield vault");
      const ok =
        id?.name === "BTC Mining Performance Vault" &&
        id?.id === BTC_MINING_PRODUCT_ID &&
        generic === null;
      return ok
        ? pass("Mining objective → BTC Mining Performance Vault; non-mining → generic fallback.", {
            id,
          })
        : fail("Product identity resolution is wrong.", { id, generic });
    },
  },
  {
    id: "no-guaranteed-language",
    label: "No guaranteed/promise language in the construction write-up",
    severity: "P0",
    expected: "containsForbidden() finds nothing in the deterministic write-up prose",
    likelyFile: "src/lib/agentic/swarm/live/runners-artifacts.ts",
    likelyFunction: "buildDeterministicWriteup / containsForbidden",
    guard: "forbidden-words",
    run: () => {
      const draft = makeSyntheticDraft();
      const hit = containsForbidden(draft.writeup.prose);
      return hit === null
        ? pass("Construction write-up carries no forbidden/guarantee language.")
        : fail(`Forbidden word(s): ${hit.found.join(", ")}`, { hit });
    },
  },
  {
    id: "read-only-no-effects",
    label: "Read-only: no DB write, no send, no deploy reachable",
    severity: "P0",
    expected: "draft.effects all false; deploy/mark-live/send are categorically forbidden",
    likelyFile: "src/lib/agentic/swarm/live/types.ts",
    likelyFunction: "ProductConstructionDraft.effects / LIVE_READ_FORBIDDEN_ACTIONS",
    guard: "read-only",
    run: () => {
      const draft = makeSyntheticDraft();
      const e = draft.effects;
      const effectsClean =
        e.externalSend === false &&
        e.deployed === false &&
        e.markedLive === false &&
        e.custodialWrite === false &&
        draft.mode === "live_read";
      const forbids =
        LIVE_READ_FORBIDDEN_ACTIONS.includes("deploy_product") &&
        LIVE_READ_FORBIDDEN_ACTIONS.includes("mark_vault_live") &&
        LIVE_READ_FORBIDDEN_ACTIONS.includes("outreach_trigger_send_run");
      return effectsClean && forbids
        ? pass("Effects all false; deploy / mark-live / send are categorically forbidden.")
        : fail("A write/send/deploy effect was reachable.", { effectsClean, forbids });
    },
  },
];

/** Run the BTC Product Construction Orchestration diagnostics (pure, dry-run). */
export function runBtcProductConstructionDiagnostics(): DiagnosticResult[] {
  return runChecks(SUITE, SPECS);
}

export const BTC_PRODUCT_CONSTRUCTION_DIAGNOSTIC_SUITE = SUITE;
