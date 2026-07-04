import { describe, it, expect, vi, beforeEach } from "vitest";

// `loadLatestMiningMetrics` feeds the Mining Health agent's daily LP
// narrative. T-13 fixed `uptime_pct` provenance (the schema column is a
// hardcoded placeholder written by `market-data-hourly.ts`, never a real
// measurement) — this suite exercises the loader's runtime behaviour
// end-to-end rather than just grepping the source for the literal tag
// (`data-honesty-guards.test.ts` POINT 7 already does the latter).

const findFirstMiningMetric = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    miningMetric: { findFirst: (...a: unknown[]) => findFirstMiningMetric(...a) },
  },
}));

import { loadLatestMiningMetrics } from "@/lib/agents/loaders/mining";

function decimal(n: number) {
  return { toNumber: () => n };
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    takenAt: new Date(),
    hashprice: decimal(0.062),
    hashpriceTrendPct: decimal(-1.4),
    miningMarginScore: 64,
    uptimePct: decimal(98.5),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadLatestMiningMetrics — provenance (T-13 regression)", () => {
  it("always tags uptime_pct as estimated on a fresh row", async () => {
    findFirstMiningMetric.mockResolvedValue(makeRow({ takenAt: new Date() }));
    const result = await loadLatestMiningMetrics();
    expect(result.provenance).toBeDefined();
    const provenance = result.provenance!;
    expect(provenance.uptime_pct).toBe("estimated");
    // Measured/derived columns share the row's freshness verdict — attested here.
    expect(provenance.hashprice_usd_per_th).toBe("attested");
    expect(provenance.difficulty_change_pct).toBe("attested");
    expect(provenance.margin_pct).toBe("attested");
  });

  it("always tags uptime_pct as estimated even on a stale row", async () => {
    findFirstMiningMetric.mockResolvedValue(
      makeRow({ takenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }),
    );
    const result = await loadLatestMiningMetrics();
    expect(result.provenance).toBeDefined();
    const provenance = result.provenance!;
    expect(provenance.uptime_pct).toBe("estimated");
    // Measured/derived columns downgrade to stale once past the SLO.
    expect(provenance.hashprice_usd_per_th).toBe("stale");
    expect(provenance.difficulty_change_pct).toBe("stale");
    expect(provenance.margin_pct).toBe("stale");
  });

  it("returns the row's numeric values converted from Decimal", async () => {
    findFirstMiningMetric.mockResolvedValue(
      makeRow({ hashprice: decimal(0.071), uptimePct: decimal(97.2) }),
    );
    const result = await loadLatestMiningMetrics();
    expect(result.hashprice_usd_per_th).toBe(0.071);
    expect(result.uptime_pct).toBe(97.2);
    expect(result.period_days).toBe(30);
  });

  it("throws when there is no MiningMetric row", async () => {
    findFirstMiningMetric.mockResolvedValue(null);
    await expect(loadLatestMiningMetrics()).rejects.toThrow(/No mining metrics in DB/i);
  });

  it("throws when a required numeric column is null", async () => {
    findFirstMiningMetric.mockResolvedValue(makeRow({ uptimePct: null }));
    await expect(loadLatestMiningMetrics()).rejects.toThrow(/uptimePct is null/i);
  });
});
