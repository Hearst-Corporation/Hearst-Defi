import { describe, it, expect } from "vitest";

import {
  buildProductEngineOutputs,
  type BridgeContext,
} from "@/lib/agentic/swarm/live/product-engine-bridge";
import { getCalculatedVsDocumented } from "@/lib/agentic/swarm/live/calculated-vs-documented";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";

function ctx(): BridgeContext {
  const lev = BTC_MINING_PERFORMANCE_VAULT.levers;
  return {
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
      productId: BTC_MINING_PERFORMANCE_VAULT.id,
      productName: BTC_MINING_PERFORMANCE_VAULT.name,
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
  };
}

describe("buildProductEngineOutputs (PROMPT 17 wiring)", () => {
  it("includes stableFundingDecision, exitRecovery, waterfalls, operatorEconomics", () => {
    const out = buildProductEngineOutputs(ctx());
    expect(out.stableFundingDecision).toBeDefined();
    expect(out.exitRecovery).toBeDefined();
    expect(out.waterfalls).toBeDefined();
    expect(out.operatorEconomics).toBeDefined();
    expect(out.monteCarloDisclosure).toBeDefined();
  });

  it("funding decision does NOT sell BTC by default at construction time", () => {
    const out = buildProductEngineOutputs(ctx());
    expect(out.stableFundingDecision.source).not.toBe("SELL_BTC_LAST_RESORT");
  });

  it("flags the funding decision PARTIAL with the missing live inputs", () => {
    const out = buildProductEngineOutputs(ctx());
    expect(out.stableFundingDecision.sourceStatus).toBe("PARTIAL");
    expect(out.stableFundingDecision.missingInputs.length).toBeGreaterThan(0);
  });

  it("exit/recovery starts at TARGET_PROGRESS with no live triggers (no early/recovery)", () => {
    const out = buildProductEngineOutputs(ctx());
    expect(out.exitRecovery.state).toBe("TARGET_PROGRESS");
    expect(out.exitRecovery.earlyExitEligible).toBe(false);
    expect(out.exitRecovery.recoveryRequired).toBe(false);
  });

  it("operator economics is separate — every value is not-validated, never the client APY", () => {
    const out = buildProductEngineOutputs(ctx());
    const opValues = Object.values(out.operatorEconomics);
    expect(opValues.every((v) => v.validated === false)).toBe(true);
    expect(
      opValues.every((v) => v.status === "CONFIGURED_NOT_VALIDATED"),
    ).toBe(true);
    // The client distribution band is untouched (read straight off the product).
    expect(BTC_MINING_PERFORMANCE_VAULT.monthlyDistributionTargetAnnualized.min).toBe(0.08);
    expect(BTC_MINING_PERFORMANCE_VAULT.monthlyDistributionTargetAnnualized.max).toBe(0.12);
  });

  it("Monte-Carlo disclosure says static and never claims path-dependent rebalancing", () => {
    const out = buildProductEngineOutputs(ctx());
    expect(out.monteCarloDisclosure.pathDependentRebalancing).toBe(false);
    expect(/static/i.test(out.monteCarloDisclosure.note)).toBe(true);
  });
});

describe("calculated-vs-documented manifest (PROMPT 17 Phase A)", () => {
  it("lists the wired engines under calculated and path-dependent MC under documentedOnly", () => {
    const cvd = getCalculatedVsDocumented();
    expect(cvd.calculated.some((c) => /Stable Funding/i.test(c))).toBe(true);
    expect(cvd.calculated.some((c) => /Exit \/ Recovery/i.test(c))).toBe(true);
    expect(cvd.calculated.some((c) => /Waterfall/i.test(c))).toBe(true);
    expect(cvd.calculated.some((c) => /Operator economics/i.test(c))).toBe(true);
    expect(cvd.documentedOnly.some((d) => /path-dependent/i.test(d))).toBe(true);
  });
});
