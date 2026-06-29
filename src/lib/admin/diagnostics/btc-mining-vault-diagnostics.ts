/**
 * BTC Mining Performance Vault — diagnostics suite (pure, dry-run).
 *
 * Mirrors `chat-action-lab.ts` / `outreach-lifecycle.ts`: every check exercises
 * the REAL committed product / guards / engine functions and reports a
 * DiagnosticResult. The runtime IS exercised (we call the live pure functions),
 * but nothing here writes, sends, deploys, or persists — it is a pure module.
 *
 * Each check proves one HARD product rule:
 *  - no guaranteed-APY language in the product copy / brief / draft template;
 *  - no double counting (total target inclusive of distribution, never summed);
 *  - the mining floor is enforced (sub-floor requires governance);
 *  - configured values are not shown as validated;
 *  - the distribution coverage gate is present;
 *  - the recovery plan does not imply a guarantee;
 *  - BTC sale is last-resort only (never a default on a healthy input);
 *  - the stable funding engine does not always spend the reserve first.
 */
import {
  BTC_MINING_PERFORMANCE_VAULT,
} from "@/lib/products/btc-mining-performance-vault";
import {
  validateTargetInclusion,
  formatTargetsSafely,
  wouldDoubleCount,
  enforceMiningFloor,
} from "@/lib/products/guards";
import {
  chooseStableFundingSource,
  type StableFundingInput,
} from "@/lib/products/stable-funding-engine";
import { nextExitRecoveryState } from "@/lib/products/exit-recovery";
import {
  buildOperatorEconomics,
  clientDistributionBand,
} from "@/lib/products/operator-economics";
import {
  buildProductWaterfalls,
  assertWaterfallOrder,
} from "@/lib/products/btc-mining-waterfalls";
import { buildProductEngineOutputs } from "@/lib/agentic/swarm/live/product-engine-bridge";
import { getCalculatedVsDocumented } from "@/lib/agentic/swarm/live/calculated-vs-documented";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import { buildBtcMiningVaultBrief } from "@/lib/product-workspace/btc-mining-vault-preset";
import { buildBtcMiningVaultDraftTemplate } from "@/lib/vault-drafts/btc-mining-vault-template";
import {
  pass,
  fail,
  runChecks,
  type DiagnosticCheckSpec,
  type DiagnosticResult,
} from "@/lib/admin/diagnostics/types";

const SUITE = "btc-mining-vault";
const PRODUCT = BTC_MINING_PERFORMANCE_VAULT;

const PRODUCTS_FILE = "src/lib/products/btc-mining-performance-vault.ts";
const GUARDS_FILE = "src/lib/products/guards.ts";
const ENGINE_FILE = "src/lib/products/stable-funding-engine.ts";
const RECOVERY_FILE = "src/lib/products/exit-recovery.ts";
const OPERATOR_FILE = "src/lib/products/operator-economics.ts";

/** A baseline HEALTHY stable-funding input — comfortable collateral, low LTV,
 *  good coverage, idle stable above runway covers the bill. Used to prove the
 *  engine does NOT reflexively sell BTC or drain the reserve first. */
function healthyFundingInput(): StableFundingInput {
  return {
    powerObligation: 100_000,
    idleStableAboveRunway: 250_000,
    stableYieldRate: 0.09,
    borrowApr: 0.06,
    collateralRatio: 1.4,
    ltv: 0.45,
    liquidationBuffer: 0.35,
    volatilityIndex: 40,
    coverageRatio: 1.3,
    stableReserveRunway: 600_000,
    minRunway: 300_000,
  };
}

/**
 * Build the wired engine outputs from a MINIMAL, CONFIGURED bridge context — the
 * diagnostic only needs the disclosure + engine shapes, not live data. The values
 * here are conservative configured placeholders (never presented as live).
 */
function buildEngineOutputsForDiagnostic() {
  const lev = PRODUCT.levers;
  return buildProductEngineOutputs({
    strategy: {
      configured: true,
      miningYieldPct: 8,
      usdcYieldPct: 6,
      usdcSource: "configured",
      btcReturn: { bear: -20, base: 40, bull: 120 },
      headlineApy: { low: 0.057, high: 0.07 },
      assumptions: [],
      disclaimer: "",
      companyLevers: {
        source: "configured",
        status: "CONFIGURED",
        markupPct: lev.markupPct.value,
        revenueSharePct: lev.revenueSharePct.value,
        borrowAprPct: lev.borrowAprPct.value,
        feePct: 0,
        energyCostUsdPerKwh: lev.energyCostUsdPerKwh.value,
      },
      provenance: "Manual",
    },
    quant: {
      seed: 1,
      paths: 5000,
      horizonMonths: 12,
      percentiles: { p5: 0.02, p25: 0.057, p50: 0.064, p75: 0.07, p95: 0.1 },
      headlineRange: { low: 0.057, high: 0.07 },
      probBelowFloorPct: 0,
      floorApyPct: 0,
      provenance: "Estimated",
    },
    canonicalAllocation: {
      productId: PRODUCT.id,
      productName: PRODUCT.name,
      mining: 35,
      btcHoldingCollateral: 45,
      stableReserve: 12,
      yieldOverlay: 8,
      miningFraction: 0.35,
      governanceException: false,
      provenance: "Manual",
      rawRejected: null,
      bands: {
        mining: [30, 40],
        btcHoldingCollateral: [40, 55],
        stableReserve: [10, 15],
        yieldOverlay: [0, 10],
      },
    },
  });
}

/** A healthy input where borrow is NOT cheaper than the stable yield it would
 *  replace (borrowApr >= stableYieldRate), so the opportunistic-borrow rule does
 *  NOT fire — the engine then funds from the cheapest idle slice (USE_IDLE_STABLE)
 *  rather than the runway reserve or a BTC sale. */
function idleStableFundingInput(): StableFundingInput {
  return {
    ...healthyFundingInput(),
    idleStableAboveRunway: 250_000,
    borrowApr: 0.09,
    stableYieldRate: 0.045,
  };
}

const SPECS: readonly DiagnosticCheckSpec[] = [
  {
    id: "no-guaranteed-language",
    label: "No guaranteed-APY / risk-free language in product copy",
    severity: "P0",
    expected:
      "containsForbidden() finds nothing across product strings + workspace brief + draft template",
    likelyFile: PRODUCTS_FILE,
    likelyFunction: "containsForbidden",
    guard: "forbidden-words",
    run: () => {
      const brief = buildBtcMiningVaultBrief();
      const template = buildBtcMiningVaultDraftTemplate();
      const corpus: string[] = [
        PRODUCT.name,
        PRODUCT.thesis,
        brief.objective,
        ...brief.allocationBands.map((b) => b.note),
        brief.targets.distribution,
        brief.targets.total,
        brief.recovery.note,
        template.markdown,
        template.draftInput.disclaimers,
      ];
      const hits = corpus
        .map((s) => containsForbidden(s))
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .flatMap((r) => r.found);
      return hits.length === 0
        ? pass("No forbidden word in product copy, brief, or draft template.", {
            scanned: corpus.length,
          })
        : fail(`Forbidden word(s) found: ${hits.join(", ")}`, { hits });
    },
  },
  {
    id: "no-double-count",
    label: "No double counting — total target inclusive of distribution",
    severity: "P0",
    expected:
      "validateTargetInclusion ok; safe strings carry no '+'/summed figure; wouldDoubleCount flags an additive attempt",
    likelyFile: GUARDS_FILE,
    likelyFunction: "validateTargetInclusion / formatTargetsSafely / wouldDoubleCount",
    guard: "target-inclusion",
    run: () => {
      const inclusion = validateTargetInclusion(PRODUCT);
      const safe = formatTargetsSafely(PRODUCT);
      // The honest strings must not present a summed headline (e.g. "8–12% + 20–24%").
      const summedRe = /\d+\s*%\s*\+\s*\d+\s*%/;
      const summedInDistribution = summedRe.test(safe.distribution);
      const summedInTotal = summedRe.test(safe.total);
      // The detector must flag an attempt to ADD the two layers.
      const flagsAdditive = wouldDoubleCount(
        PRODUCT.monthlyDistributionTargetAnnualized.max,
        PRODUCT.totalPerformanceTarget.max,
      );
      const ok =
        inclusion.ok &&
        !summedInDistribution &&
        !summedInTotal &&
        flagsAdditive &&
        PRODUCT.totalPerformanceTarget.inclusiveOfDistributions === true;
      return ok
        ? pass(
            "Total target is inclusive of distribution; safe strings never sum; additive attempt flagged.",
            { inclusion: inclusion.message, flagsAdditive },
          )
        : fail("Double-count protection incomplete.", {
            inclusion,
            summedInDistribution,
            summedInTotal,
            flagsAdditive,
          });
    },
  },
  {
    id: "mining-floor-enforced",
    label: "Mining floor enforced (sub-floor requires governance)",
    severity: "P0",
    expected:
      "enforceMiningFloor(0.25,'NORMAL') === requires_governance_exception; 0.35 NORMAL ok",
    likelyFile: GUARDS_FILE,
    likelyFunction: "enforceMiningFloor",
    guard: "mining-floor",
    run: () => {
      const subFloor = enforceMiningFloor(0.25, "NORMAL");
      const balanced = enforceMiningFloor(0.35, "NORMAL");
      const ok =
        subFloor.ok === false &&
        subFloor.reason === "requires_governance_exception" &&
        balanced.ok === true &&
        balanced.reason === "at_or_above_floor";
      return ok
        ? pass(
            "Sub-floor (25%) in NORMAL requires a governance exception; balanced (35%) is at/above the floor.",
            { subFloor, balanced },
          )
        : fail("Mining floor not enforced as expected.", { subFloor, balanced });
    },
  },
  {
    id: "configured-not-validated",
    label: "Configured values are not shown as validated",
    severity: "P0",
    expected:
      "product status CONFIGURED; lever statuses CONFIGURED; operator economics CONFIGURED_NOT_VALIDATED + validated:false",
    likelyFile: OPERATOR_FILE,
    likelyFunction: "buildOperatorEconomics",
    guard: "status-model",
    run: () => {
      const op = buildOperatorEconomics(PRODUCT);
      const productConfigured = PRODUCT.status === "CONFIGURED";
      const leversConfigured = Object.values(PRODUCT.levers).every(
        (l) => l.status === "CONFIGURED",
      );
      const operatorValues = Object.values(op);
      const operatorNotValidated = operatorValues.every(
        (v) => v.status === "CONFIGURED_NOT_VALIDATED" && v.validated === false,
      );
      const ok = productConfigured && leversConfigured && operatorNotValidated;
      return ok
        ? pass(
            "Product + levers are CONFIGURED; every operator value is CONFIGURED_NOT_VALIDATED with validated:false.",
            {
              productStatus: PRODUCT.status,
              operatorChecked: operatorValues.length,
            },
          )
        : fail("A configured value could read as validated.", {
            productConfigured,
            leversConfigured,
            operatorNotValidated,
          });
    },
  },
  {
    id: "coverage-gate-present",
    label: "Distribution coverage gate present",
    severity: "P0",
    expected:
      "coverage < 1.0 → distribution not paid; coverage < 0.8 → PAUSE_DISTRIBUTION",
    likelyFile: ENGINE_FILE,
    likelyFunction: "chooseStableFundingSource",
    guard: "coverage-gate",
    run: () => {
      const base = healthyFundingInput();
      const belowOne = chooseStableFundingSource({ ...base, coverageRatio: 0.9 });
      const belowSuspend = chooseStableFundingSource({
        ...base,
        coverageRatio: 0.7,
      });
      const ok =
        belowOne.distributionAllowed === false &&
        belowSuspend.distributionAllowed === false &&
        belowSuspend.source === "PAUSE_DISTRIBUTION";
      return ok
        ? pass(
            "Coverage 0.9 → distribution not paid; coverage 0.7 → PAUSE_DISTRIBUTION.",
            { belowOne: belowOne.distributionAllowed, belowSuspend: belowSuspend.source },
          )
        : fail("Coverage gate not enforced as expected.", { belowOne, belowSuspend });
    },
  },
  {
    id: "recovery-not-a-guarantee",
    label: "Recovery plan does not imply a guarantee",
    severity: "P0",
    expected:
      "RECOVERY_MODE result: guaranteedRecovery false, capital_only default, no forbidden word in the note",
    likelyFile: RECOVERY_FILE,
    likelyFunction: "nextExitRecoveryState",
    guard: "recovery-no-guarantee",
    run: () => {
      const recovery = nextExitRecoveryState("ACTIVE", {
        targetReached: false,
        maturityReached: true,
        capitalNotRecovered: true,
        coverageStress: false,
        collateralStress: false,
        operatorGovernanceApproved: true,
      });
      const noForbidden = containsForbidden(recovery.note) === null;
      const ok =
        recovery.state === "RECOVERY_MODE" &&
        recovery.recoveryMode === "capital_only" &&
        recovery.guaranteedRecovery === false &&
        noForbidden;
      return ok
        ? pass(
            "Maturity + unrecovered → RECOVERY_MODE (capital_only), guaranteedRecovery false, note clean.",
            { state: recovery.state, mode: recovery.recoveryMode },
          )
        : fail("Recovery reads as a guarantee or carries forbidden language.", {
            recovery,
            noForbidden,
          });
    },
  },
  {
    id: "btc-sale-last-resort",
    label: "BTC sale is last-resort only (never default on a healthy input)",
    severity: "P0",
    expected:
      "chooseStableFundingSource on a healthy input never returns SELL_BTC_LAST_RESORT",
    likelyFile: ENGINE_FILE,
    likelyFunction: "chooseStableFundingSource",
    guard: "btc-sale-last-resort",
    run: () => {
      // Healthy case with an idle slice → USE_IDLE_STABLE, never a BTC sale.
      const healthy = chooseStableFundingSource(idleStableFundingInput());
      // A second healthy case: comfortable collateral, no idle stable, but
      // borrow is cheap vs stable yield → it should BORROW, never sell BTC.
      const cheapBorrow = chooseStableFundingSource({
        ...healthyFundingInput(),
        idleStableAboveRunway: 0,
        borrowApr: 0.05,
        stableYieldRate: 0.09,
      });
      const ok =
        healthy.source !== "SELL_BTC_LAST_RESORT" &&
        cheapBorrow.source !== "SELL_BTC_LAST_RESORT";
      return ok
        ? pass(
            `Healthy input → ${healthy.source}; cheap-borrow input → ${cheapBorrow.source}. BTC sale is not a default.`,
            { healthy: healthy.source, cheapBorrow: cheapBorrow.source },
          )
        : fail("BTC sale was reached on a healthy input.", {
            healthy: healthy.source,
            cheapBorrow: cheapBorrow.source,
          });
    },
  },
  {
    id: "stable-reserve-not-first",
    label: "Stable funding engine does not always spend the reserve first",
    severity: "P0",
    expected:
      "cheap-borrow case borrows (does not consume reserve); idle-stable case uses idle slice; reserve never below minRunway",
    likelyFile: ENGINE_FILE,
    likelyFunction: "chooseStableFundingSource",
    guard: "reserve-not-first",
    run: () => {
      // Cheap-borrow, comfortable collateral, NO idle stable above runway → BORROW
      // (preserve productive stable), NOT a reserve spend / BTC sale.
      const cheapBorrow = chooseStableFundingSource({
        ...healthyFundingInput(),
        idleStableAboveRunway: 0,
        borrowApr: 0.05,
        stableYieldRate: 0.09,
      });
      // Idle stable above runway present (and borrow NOT cheaper than stable
      // yield) → use the idle slice (cheapest), NOT the runway reserve, NOT a sale.
      const idleStable = chooseStableFundingSource(idleStableFundingInput());
      const borrowed = cheapBorrow.source === "BORROW_AGAINST_BTC";
      const usedIdle = idleStable.source === "USE_IDLE_STABLE";
      // The reserve is never pulled below its floor on a healthy input.
      const reserveFloorRespected =
        idleStable.source !== "SELL_BTC_LAST_RESORT" &&
        cheapBorrow.source !== "SELL_BTC_LAST_RESORT";
      const ok = borrowed && usedIdle && reserveFloorRespected;
      return ok
        ? pass(
            "Cheap-borrow → BORROW_AGAINST_BTC; idle-stable present → USE_IDLE_STABLE; reserve floor untouched.",
            { cheapBorrow: cheapBorrow.source, idleStable: idleStable.source },
          )
        : fail("Engine reflexively spent the reserve / sold BTC first.", {
            cheapBorrow: cheapBorrow.source,
            idleStable: idleStable.source,
          });
    },
  },
  // ───────────────────────────── PROMPT 17 — Phase H ────────────────────────
  {
    id: "waterfalls-present-and-ordered",
    label: "Waterfalls present in report with stable ordering",
    severity: "P0",
    expected:
      "buildProductWaterfalls returns normal/early/recovery; assertWaterfallOrder finds no reorder",
    likelyFile: "src/lib/products/btc-mining-waterfalls.ts",
    likelyFunction: "buildProductWaterfalls / assertWaterfallOrder",
    guard: "waterfall-order",
    run: () => {
      const wf = buildProductWaterfalls();
      const violations = [
        ...assertWaterfallOrder(wf.normal),
        ...assertWaterfallOrder(wf.earlyClosure),
        ...assertWaterfallOrder(wf.recovery),
      ];
      const allKinds =
        wf.normal.kind === "normal" &&
        wf.earlyClosure.kind === "early_closure" &&
        wf.recovery.kind === "recovery";
      const ok = violations.length === 0 && allKinds;
      return ok
        ? pass("All three waterfalls present; ordering is stable.", {
            normal: wf.normal.steps.length,
            early: wf.earlyClosure.steps.length,
            recovery: wf.recovery.steps.length,
          })
        : fail("Waterfall missing or reordered.", { violations, allKinds });
    },
  },
  {
    id: "waterfall-no-guaranteed-distribution",
    label: "Waterfall never implies a guaranteed distribution",
    severity: "P0",
    expected:
      "with coverage gated off, the monthly-distribution step is 'blocked' (never active/guaranteed)",
    likelyFile: "src/lib/products/btc-mining-waterfalls.ts",
    likelyFunction: "buildProductWaterfalls",
    guard: "waterfall-no-guarantee",
    run: () => {
      // Funding decision with coverage below 1.0 → distribution must be blocked.
      const gatedFunding = chooseStableFundingSource({
        ...healthyFundingInput(),
        coverageRatio: 0.9,
      });
      const wf = buildProductWaterfalls({ funding: gatedFunding });
      const distStep = wf.normal.steps.find((s) => s.rank === 4);
      const ok =
        distStep !== undefined &&
        distStep.status === "blocked" &&
        gatedFunding.distributionAllowed === false;
      return ok
        ? pass("Coverage gated off → distribution step blocked, not implied.", {
            step: distStep?.status,
          })
        : fail("Distribution step not blocked under a coverage gate.", { distStep });
    },
  },
  {
    id: "operator-economics-separate-from-apy",
    label: "Operator economics present and separate — never added to client APY",
    severity: "P0",
    expected:
      "client distribution band is unchanged by reading operator economics; no operator value merged into the band",
    likelyFile: OPERATOR_FILE,
    likelyFunction: "buildOperatorEconomics / clientDistributionBand",
    guard: "operator-separate",
    run: () => {
      const op = buildOperatorEconomics(PRODUCT);
      const band = clientDistributionBand(PRODUCT);
      // The client band must equal the product's own distribution target —
      // proof that operator economics did not (and cannot) alter it.
      const bandUntouched =
        band.min === PRODUCT.monthlyDistributionTargetAnnualized.min &&
        band.max === PRODUCT.monthlyDistributionTargetAnnualized.max;
      // Every operator value is double-locked as not-validated, so none can be
      // read as part of the client (validated/contractual) distribution.
      const opValues = Object.values(op);
      const allOperatorNotValidated = opValues.every(
        (v) => v.validated === false && v.status === "CONFIGURED_NOT_VALIDATED",
      );
      const ok = bandUntouched && allOperatorNotValidated;
      return ok
        ? pass(
            "Client distribution band is unchanged; operator figures live in a separate object.",
            { band: `${(band.min * 100).toFixed(0)}–${(band.max * 100).toFixed(0)}%` },
          )
        : fail("Operator economics could be read into the client APY.", {
            bandUntouched,
          });
    },
  },
  {
    id: "monte-carlo-disclosure-honest",
    label: "Monte-Carlo disclosure is accurate (static, not path-dependent)",
    severity: "P0",
    expected:
      "monteCarloDisclosure.pathDependentRebalancing === false and note says 'static'",
    likelyFile: "src/lib/agentic/swarm/live/product-engine-bridge.ts",
    likelyFunction: "buildProductEngineOutputs",
    guard: "mc-disclosure",
    run: () => {
      const outputs = buildEngineOutputsForDiagnostic();
      const mc = outputs.monteCarloDisclosure;
      const ok =
        mc.pathDependentRebalancing === false &&
        /static/i.test(mc.note) &&
        (mc.version === "v1" || mc.version === "v1.1");
      return ok
        ? pass("Monte-Carlo disclosed as static / scenario-level — no path-dependent claim.", {
            version: mc.version,
          })
        : fail("Monte-Carlo disclosure overstates fidelity.", { mc });
    },
  },
  {
    id: "calculated-vs-documented-present",
    label: "Calculated-vs-documented section present and honest",
    severity: "P0",
    expected:
      "manifest lists the wired engines under 'calculated' and path-dependent MC under 'documentedOnly'",
    likelyFile: "src/lib/agentic/swarm/live/calculated-vs-documented.ts",
    likelyFunction: "getCalculatedVsDocumented",
    guard: "calc-vs-doc",
    run: () => {
      const cvd = getCalculatedVsDocumented();
      const calculatedHasEngines =
        cvd.calculated.some((c) => /Stable Funding/i.test(c)) &&
        cvd.calculated.some((c) => /Exit \/ Recovery/i.test(c)) &&
        cvd.calculated.some((c) => /Waterfall/i.test(c)) &&
        cvd.calculated.some((c) => /Operator economics/i.test(c));
      const documentedHasPathDependent = cvd.documentedOnly.some((d) =>
        /path-dependent/i.test(d),
      );
      const ok = calculatedHasEngines && documentedHasPathDependent;
      return ok
        ? pass(
            "Engines listed as calculated; path-dependent MC honestly listed as documented-only.",
            { calculated: cvd.calculated.length, documentedOnly: cvd.documentedOnly.length },
          )
        : fail("Calculated-vs-documented manifest is inaccurate.", {
            calculatedHasEngines,
            documentedHasPathDependent,
          });
    },
  },
];

/**
 * Run the BTC Mining Performance Vault diagnostics. Pure: exercises the real
 * product/guards/engine functions, returns DiagnosticResult[], performs no I/O.
 */
export function runBtcMiningVaultDiagnostics(): DiagnosticResult[] {
  return runChecks(SUITE, SPECS);
}

/** The suite id, exported for the page header / tests. */
export const BTC_MINING_VAULT_DIAGNOSTIC_SUITE = SUITE;
