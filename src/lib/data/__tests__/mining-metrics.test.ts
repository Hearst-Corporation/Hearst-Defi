import { describe, it, expect, vi, beforeEach } from "vitest";

// mining-metrics.ts derives the /portfolio mining tiles (production, hashrate,
// uptime, efficiency, mining/margin risk axes) from real `MiningMetric` rows,
// always badged "estimated" (see the module's header comment for why — the
// row's `uptimePct` column itself is a hardcoded cron placeholder, and every
// value below is an aggregation/model on top of the raw columns, never a
// direct measurement). This suite exercises the loader end-to-end against a
// mocked prisma client (same pattern as
// src/lib/agents/loaders/__tests__/mining-latest-metrics.test.ts).

const findManyMiningMetric = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    miningMetric: { findMany: (...a: unknown[]) => findManyMiningMetric(...a) },
  },
}));

import { loadMiningMetrics } from "@/lib/data/mining-metrics";

function decimal(n: number) {
  return { toNumber: () => n };
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    takenAt: new Date("2026-06-15T12:00:00Z"),
    deployedHashrate: decimal(182_000), // TH/s → 182.0 PH/s
    hashprice: decimal(0.06), // $/TH/day
    btcPrice: decimal(60_000),
    energyCost: decimal(0.05),
    uptimePct: decimal(98.5),
    miningMarginScore: 23,
    operationalConfidence: 70,
    alertLevel: "green",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadMiningMetrics — fallback contract", () => {
  it("returns null when the table has no rows (callers must fall back to pilot-fixtures)", async () => {
    findManyMiningMetric.mockResolvedValue([]);
    const result = await loadMiningMetrics();
    expect(result).toBeNull();
  });
});

describe("loadMiningMetrics — derivation invariants", () => {
  it("formats the latest deployedHashrate as PH/s", async () => {
    findManyMiningMetric.mockResolvedValue([makeRow()]);
    const result = await loadMiningMetrics();
    expect(result).not.toBeNull();
    expect(result!.allocatedHashrate).toBe("182.0 PH/s");
  });

  it("uptime segments sum to ~100 and stay within [0,100]", async () => {
    findManyMiningMetric.mockResolvedValue([
      makeRow({ uptimePct: decimal(96.4) }),
      makeRow({ uptimePct: decimal(97.8) }),
    ]);
    const result = await loadMiningMetrics();
    expect(result).not.toBeNull();
    const total = result!.uptimeSegments.reduce((s, seg) => s + seg.pct, 0);
    expect(total).toBeGreaterThanOrEqual(99.9);
    expect(total).toBeLessThanOrEqual(100.1);
    for (const seg of result!.uptimeSegments) {
      expect(seg.pct).toBeGreaterThanOrEqual(0);
      expect(seg.pct).toBeLessThanOrEqual(100);
    }
    // Only "online" + "unscheduled" are derivable from a single scalar column
    // — no fabricated curtailed/scheduled breakdown.
    expect(result!.uptimeSegments.map((s) => s.cause).sort()).toEqual([
      "online",
      "unscheduled",
    ]);
  });

  it("efficiency stays within the documented plausible band", async () => {
    findManyMiningMetric.mockResolvedValue([makeRow()]);
    const result = await loadMiningMetrics();
    expect(result).not.toBeNull();
    expect(result!.efficiency.value).toBeGreaterThan(0);
    expect(result!.efficiency.value).toBeLessThanOrEqual(result!.efficiency.max);
  });

  it("mining/margin risk dimensions are 0-100 and always provenance 'estimated'", async () => {
    findManyMiningMetric.mockResolvedValue([makeRow({ miningMarginScore: 31, operationalConfidence: 40 })]);
    const result = await loadMiningMetrics();
    expect(result).not.toBeNull();
    const { mining, margin } = result!.riskDimensions;
    expect(mining.provenance).toBe("estimated");
    expect(margin.provenance).toBe("estimated");
    expect(mining.score).toBeGreaterThanOrEqual(0);
    expect(mining.score).toBeLessThanOrEqual(100);
    expect(margin.score).toBeGreaterThanOrEqual(0);
    expect(margin.score).toBeLessThanOrEqual(100);
    // mining score mirrors miningMarginScore directly.
    expect(mining.score).toBe(31);
    // margin score is the inverse of operationalConfidence (40 → 60).
    expect(margin.score).toBe(60);
  });

  it("aggregates multiple hourly rows into monthly production, flagging the latest month estimated", async () => {
    const rows = [
      makeRow({ takenAt: new Date("2026-05-15T00:00:00Z") }),
      makeRow({ takenAt: new Date("2026-05-15T01:00:00Z") }),
      makeRow({ takenAt: new Date("2026-06-15T00:00:00Z") }),
    ];
    findManyMiningMetric.mockResolvedValue(rows);
    const result = await loadMiningMetrics();
    expect(result).not.toBeNull();
    expect(result!.production.length).toBe(2);
    const [may, june] = result!.production;
    expect(may!.label).toBe("May");
    expect(may!.estimated).toBeUndefined();
    expect(june!.label).toBe("Jun");
    expect(june!.estimated).toBe(true);
    // Every produced amount is non-negative.
    for (const d of result!.production) {
      expect(d.btc).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("loadMiningMetrics — investor share scaling", () => {
  it("with no share passed, returns the unscaled fleet-wide hashrate (backward compatible)", async () => {
    findManyMiningMetric.mockResolvedValue([makeRow()]);
    const result = await loadMiningMetrics();
    expect(result).not.toBeNull();
    expect(result!.allocatedHashrate).toBe("182.0 PH/s");
  });

  it("scales allocatedHashrate by principalUsdc / capacityUsdc (2% share → 3.64 PH/s)", async () => {
    findManyMiningMetric.mockResolvedValue([makeRow()]);
    const result = await loadMiningMetrics({
      principalUsdc: 2_000_000,
      capacityUsdc: 100_000_000,
    });
    expect(result).not.toBeNull();
    // 182.0 PH/s fleet × 2% share = 3.64 PH/s → formatted to 1 decimal.
    expect(result!.allocatedHashrate).toBe("3.6 PH/s");
  });

  it("scales production by the same share as hashrate", async () => {
    const row = makeRow();
    findManyMiningMetric.mockResolvedValue([row]);

    const unscaled = await loadMiningMetrics();
    const scaled = await loadMiningMetrics({
      principalUsdc: 2_000_000,
      capacityUsdc: 100_000_000,
    });

    expect(unscaled).not.toBeNull();
    expect(scaled).not.toBeNull();
    const unscaledBtc = unscaled!.production[0]!.btc;
    const scaledBtc = scaled!.production[0]!.btc;
    expect(unscaledBtc).toBeGreaterThan(0);
    // Allow for the 3-decimal rounding on both sides.
    expect(scaledBtc).toBeCloseTo(unscaledBtc * 0.02, 2);
  });

  it("does NOT scale uptimeSegments, efficiency, or riskDimensions (operation-level, not per-investor)", async () => {
    findManyMiningMetric.mockResolvedValue([makeRow()]);
    const unscaled = await loadMiningMetrics();
    const scaled = await loadMiningMetrics({
      principalUsdc: 2_000_000,
      capacityUsdc: 100_000_000,
    });
    expect(unscaled).not.toBeNull();
    expect(scaled).not.toBeNull();
    expect(scaled!.uptimeSegments).toEqual(unscaled!.uptimeSegments);
    expect(scaled!.efficiency).toEqual(unscaled!.efficiency);
    expect(scaled!.riskDimensions).toEqual(unscaled!.riskDimensions);
  });

  it("guards division by zero: capacityUsdc <= 0 falls back to unscaled (never NaN/Infinity)", async () => {
    findManyMiningMetric.mockResolvedValue([makeRow()]);
    const result = await loadMiningMetrics({ principalUsdc: 2_000_000, capacityUsdc: 0 });
    expect(result).not.toBeNull();
    expect(result!.allocatedHashrate).toBe("182.0 PH/s");
    expect(Number.isFinite(result!.production[0]?.btc ?? 0)).toBe(true);
  });

  it("guards no position: principalUsdc <= 0 with a valid capacity zeroes the allocation instead of NaN", async () => {
    findManyMiningMetric.mockResolvedValue([makeRow()]);
    const result = await loadMiningMetrics({ principalUsdc: 0, capacityUsdc: 100_000_000 });
    expect(result).not.toBeNull();
    expect(result!.allocatedHashrate).toBe("0.0 PH/s");
    expect(result!.production[0]?.btc).toBe(0);
  });
});
