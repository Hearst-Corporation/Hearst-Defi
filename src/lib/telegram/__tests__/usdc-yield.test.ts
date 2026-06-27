import { describe, it, expect } from "vitest";

import { decideUsdcPlacement, type UsdcPool } from "../usdc-yield";

const morpho: UsdcPool = { project: "morpho-blue", chain: "Base", apy: 9, tvlUsd: 50e6, pool: "morpho-1" };
const aave: UsdcPool = { project: "aave-v3", chain: "Ethereum", apy: 5, tvlUsd: 800e6, pool: "aave-1" };
const tiny: UsdcPool = { project: "risky-fork", chain: "Base", apy: 30, tvlUsd: 1e6, pool: "tiny-1" };

describe("decideUsdcPlacement", () => {
  it("deploys into the best eligible pool when not yet deployed", () => {
    const d = decideUsdcPlacement({
      pools: [aave, morpho],
      capitalUsd: 1_000_000,
      currentPoolId: null,
      switchCostUsd: 50,
    });
    expect(d.action).toBe("deploy");
    expect(d.target?.pool).toBe("morpho-1"); // 9% > 5%
  });

  it("ignores pools below the TVL floor (no chasing a 30% on $1M TVL)", () => {
    const d = decideUsdcPlacement({
      pools: [aave, tiny],
      capitalUsd: 1_000_000,
      currentPoolId: null,
      switchCostUsd: 50,
    });
    expect(d.target?.pool).toBe("aave-1"); // tiny excluded → aave wins
  });

  it("holds when already in the top venue", () => {
    const d = decideUsdcPlacement({
      pools: [aave, morpho],
      capitalUsd: 1_000_000,
      currentPoolId: "morpho-1",
      switchCostUsd: 50,
    });
    expect(d.action).toBe("hold");
  });

  it("switches when net-of-fees gain over the window is positive", () => {
    // current aave 5%, best morpho 9% → +4pp on $1M over 30d = ~$3,288 gross.
    const d = decideUsdcPlacement({
      pools: [aave, morpho],
      capitalUsd: 1_000_000,
      currentPoolId: "aave-1",
      switchCostUsd: 50,
    });
    expect(d.action).toBe("switch");
    expect(d.target?.pool).toBe("morpho-1");
    expect(d.netGainUsd).toBeGreaterThan(0);
  });

  it("holds when the fee eats the pickup (small capital, big fee)", () => {
    // +4pp on $5,000 over 30d ≈ $16 gross, switch costs $500 → not worth it.
    const d = decideUsdcPlacement({
      pools: [aave, morpho],
      capitalUsd: 5_000,
      currentPoolId: "aave-1",
      switchCostUsd: 500,
    });
    expect(d.action).toBe("hold");
    expect(d.netGainUsd).toBeLessThan(0);
  });

  it("holds when no eligible pool exists", () => {
    const d = decideUsdcPlacement({
      pools: [tiny], // below TVL floor
      capitalUsd: 1_000_000,
      currentPoolId: null,
      switchCostUsd: 50,
    });
    expect(d.action).toBe("hold");
    expect(d.target).toBeNull();
  });

  it("longer payback window justifies a switch a short one would reject", () => {
    const common = {
      pools: [aave, { ...morpho, apy: 5.5 }], // only +0.5pp
      capitalUsd: 1_000_000,
      currentPoolId: "aave-1",
      switchCostUsd: 300,
    };
    const short = decideUsdcPlacement({ ...common, paybackDays: 7 });
    const long = decideUsdcPlacement({ ...common, paybackDays: 90 });
    expect(short.action).toBe("hold");
    expect(long.action).toBe("switch");
  });
});
