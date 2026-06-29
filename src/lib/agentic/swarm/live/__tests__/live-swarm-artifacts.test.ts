import { describe, expect, it } from "vitest";

import {
  runCharts,
  buildDeterministicWriteup,
} from "@/lib/agentic/swarm/live/runners-artifacts";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import type {
  QuantArtifact,
  StrategyCrossArtifact,
} from "@/lib/agentic/swarm/live/types";

const STRATEGY: StrategyCrossArtifact = {
  configured: true,
  miningYieldPct: 14.2,
  usdcYieldPct: 4.8,
  usdcSource: "aave",
  btcReturn: { bear: -20, base: 10, bull: 40 },
  headlineApy: { low: 9.4, high: 12.8 },
  assumptions: ["Mining at 6¢/kWh", "USDC from top DeFi pool"],
  disclaimer: "Projection conditionnelle — non garantie.",
  companyLevers: {
    source: "config",
    status: "CONFIGURED",
    markupPct: 25,
    revenueSharePct: 20,
    borrowAprPct: 6,
    feePct: 2,
    energyCostUsdPerKwh: 0.06,
  },
  provenance: "Live",
};

const QUANT: QuantArtifact = {
  seed: 12345,
  paths: 5000,
  horizonMonths: 12,
  percentiles: { p5: 0.06, p25: 0.094, p50: 0.111, p75: 0.128, p95: 0.16 },
  headlineRange: { low: 0.094, high: 0.128 },
  probBelowFloorPct: 8.5,
  floorApyPct: 8,
  provenance: "Live",
};

describe("charts runner (E)", () => {
  it("produces a fan chart with one band per horizon month + edges", () => {
    const { charts } = runCharts({ strategy: STRATEGY, quant: QUANT });
    const fan = charts.find((c) => c.kind === "fan");
    expect(fan).toBeDefined();
    expect(fan!.fanBands).toHaveLength(QUANT.horizonMonths + 1);
    // p5 ≤ p50 ≤ p95 at the horizon end.
    const last = fan!.fanBands!.at(-1)!;
    expect(last.p5).toBeLessThanOrEqual(last.p50);
    expect(last.p50).toBeLessThanOrEqual(last.p95);
    expect(fan!.seedLabel).toContain("12345");
  });

  it("produces an allocation + headline-range chart, no invented numbers", () => {
    const { charts } = runCharts({ strategy: STRATEGY, quant: QUANT });
    const alloc = charts.find((c) => c.kind === "allocation");
    expect(alloc!.allocation).toEqual([
      { label: "Mining yield", valuePct: 14.2 },
      { label: "USDC yield", valuePct: 4.8 },
    ]);
    const value = charts.find((c) => c.kind === "value");
    expect(value!.valuePoints!.map((p) => p.y)).toEqual([9.4, 12.8]);
  });
});

describe("deterministic writeup runner (F fallback)", () => {
  it("writes a range APY and never a forbidden word or single point", () => {
    const w = buildDeterministicWriteup({
      objective: "BTC yield vault with downside protection",
      vaultLabel: "Hearst Yield Vault",
      strategy: STRATEGY,
      quant: QUANT,
      market: { btcUsd: 64000, hashpriceUsdPerThDay: 0.052 },
    });
    expect(w.llmAuthored).toBe(false);
    expect(w.prose).toContain("9.4–12.8%"); // headline as a RANGE, not a point
    expect(w.prose.toLowerCase()).toContain("not guaranteed".toLowerCase());
    expect(containsForbidden(w.prose)).toBeNull(); // no guarantee/promise/etc.
  });

  it("includes the assumptions and the company levers", () => {
    const w = buildDeterministicWriteup({
      objective: "obj",
      vaultLabel: "HYV",
      strategy: STRATEGY,
      quant: QUANT,
      market: { btcUsd: 64000, hashpriceUsdPerThDay: 0.052 },
    });
    expect(w.prose).toContain("Mining at 6¢/kWh");
    expect(w.prose).toContain("markup 25%");
  });
});
