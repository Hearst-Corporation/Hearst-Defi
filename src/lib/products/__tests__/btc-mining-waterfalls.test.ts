import { describe, it, expect } from "vitest";

import {
  buildProductWaterfalls,
  assertWaterfallOrder,
} from "@/lib/products/btc-mining-waterfalls";
import { chooseStableFundingSource } from "@/lib/products/stable-funding-engine";
import { nextExitRecoveryState } from "@/lib/products/exit-recovery";

describe("btc-mining-waterfalls (PROMPT 17 Phase D)", () => {
  it("produces all three waterfalls with stable ordering", () => {
    const wf = buildProductWaterfalls();
    expect(wf.normal.kind).toBe("normal");
    expect(wf.earlyClosure.kind).toBe("early_closure");
    expect(wf.recovery.kind).toBe("recovery");
    expect(assertWaterfallOrder(wf.normal)).toEqual([]);
    expect(assertWaterfallOrder(wf.earlyClosure)).toEqual([]);
    expect(assertWaterfallOrder(wf.recovery)).toEqual([]);
  });

  it("ranks are 1..n in fixed order for every waterfall", () => {
    const wf = buildProductWaterfalls();
    for (const w of [wf.normal, wf.earlyClosure, wf.recovery]) {
      w.steps.forEach((s, i) => expect(s.rank).toBe(i + 1));
    }
  });

  it("never implies a guaranteed distribution — coverage gated → step blocked", () => {
    const gated = chooseStableFundingSource({
      powerObligation: 100_000,
      idleStableAboveRunway: 250_000,
      stableYieldRate: 0.09,
      borrowApr: 0.06,
      collateralRatio: 1.4,
      ltv: 0.45,
      liquidationBuffer: 0.35,
      volatilityIndex: 40,
      coverageRatio: 0.9, // below the pay threshold
      stableReserveRunway: 600_000,
      minRunway: 300_000,
    });
    const wf = buildProductWaterfalls({ funding: gated });
    const dist = wf.normal.steps.find((s) => s.rank === 4)!;
    expect(gated.distributionAllowed).toBe(false);
    expect(dist.status).toBe("blocked");
  });

  it("distribution step active when coverage allows it", () => {
    const ok = chooseStableFundingSource({
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
    });
    const wf = buildProductWaterfalls({ funding: ok });
    const dist = wf.normal.steps.find((s) => s.rank === 4)!;
    expect(ok.distributionAllowed).toBe(true);
    expect(dist.status).toBe("active");
  });

  it("early-closure steps go active only in EARLY_EXIT_ELIGIBLE", () => {
    const early = nextExitRecoveryState("ACTIVE", {
      targetReached: true,
      maturityReached: false,
      capitalNotRecovered: false,
      coverageStress: false,
      collateralStress: false,
      operatorGovernanceApproved: false,
    });
    expect(early.state).toBe("EARLY_EXIT_ELIGIBLE");
    const wf = buildProductWaterfalls({ exitRecovery: early });
    expect(wf.earlyClosure.steps.every((s) => s.status === "active")).toBe(true);
    // Recovery is not applicable in early-exit.
    expect(wf.recovery.steps.every((s) => s.status === "not_applicable")).toBe(true);
  });

  it("recovery steps engage only in RECOVERY_MODE and never imply a guarantee", () => {
    const rec = nextExitRecoveryState("ACTIVE", {
      targetReached: false,
      maturityReached: true,
      capitalNotRecovered: true,
      coverageStress: false,
      collateralStress: false,
      operatorGovernanceApproved: true,
    });
    expect(rec.state).toBe("RECOVERY_MODE");
    expect(rec.guaranteedRecovery).toBe(false);
    const wf = buildProductWaterfalls({ exitRecovery: rec });
    // The optional min-yield step (rank 5) is pending, not active.
    const optional = wf.recovery.steps.find((s) => s.rank === 5)!;
    expect(optional.status).toBe("pending");
    expect(/not guaranteed|not a promise/i.test(optional.note)).toBe(true);
  });
});
