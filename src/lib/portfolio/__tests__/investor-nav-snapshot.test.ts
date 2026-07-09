import { describe, expect, it, vi, beforeEach } from "vitest";

const positionFindManyMock = vi.hoisted(() => vi.fn());
const investorFindManyMock = vi.hoisted(() => vi.fn());
const navSnapshotUpsertMock = vi.hoisted(() => vi.fn());
const navSnapshotFindManyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    position: { findMany: positionFindManyMock },
    investor: { findMany: investorFindManyMock },
    investorNavSnapshot: {
      upsert: navSnapshotUpsertMock,
      findMany: navSnapshotFindManyMock,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import {
  captureAllInvestorNavSnapshots,
  captureInvestorNavSnapshot,
  computeInvestorNavUsdc,
  loadHourlyValueSnapshots,
  reconstructInvestorNavSeries,
  truncateToUtcHour,
} from "../investor-nav-snapshot";

describe("truncateToUtcHour", () => {
  it("zeroes minutes and seconds in UTC", () => {
    const d = new Date("2026-06-25T14:37:22.500Z");
    const h = truncateToUtcHour(d);
    expect(h.toISOString()).toBe("2026-06-25T14:00:00.000Z");
  });
});

describe("computeInvestorNavUsdc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sums principal + accrued for active positions", async () => {
    positionFindManyMock.mockResolvedValue([
      { principalUsdc: 100, accruedYieldUsdc: 5 },
      { principalUsdc: 50, accruedYieldUsdc: 2.5 },
    ]);

    await expect(computeInvestorNavUsdc("inv-1")).resolves.toBe(157.5);
  });

  it("returns null when investor has no positions", async () => {
    positionFindManyMock.mockResolvedValue([]);
    await expect(computeInvestorNavUsdc("inv-1")).resolves.toBeNull();
  });
});

describe("captureInvestorNavSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    positionFindManyMock.mockResolvedValue([
      { principalUsdc: 11, accruedYieldUsdc: 0 },
    ]);
    navSnapshotUpsertMock.mockResolvedValue({ id: "snap-1" });
  });

  it("upserts hourly bucket with live NAV", async () => {
    const at = new Date("2026-06-25T12:34:00Z");
    const result = await captureInvestorNavSnapshot("inv-1", at);

    expect(result).toMatchObject({ snapshotId: "snap-1", valueUsdc: 11 });
    expect(navSnapshotUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          investorId_takenAt: {
            investorId: "inv-1",
            takenAt: truncateToUtcHour(at),
          },
        },
        create: expect.objectContaining({ valueUsdc: 11, source: "computed" }),
      }),
    );
  });

  it("skips when no positions", async () => {
    positionFindManyMock.mockResolvedValue([]);
    await expect(captureInvestorNavSnapshot("inv-1")).resolves.toEqual({
      skipped: true,
      reason: "no_positions",
    });
  });
});

describe("captureAllInvestorNavSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    investorFindManyMock.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    positionFindManyMock.mockResolvedValue([
      { principalUsdc: 10, accruedYieldUsdc: 1 },
    ]);
    navSnapshotUpsertMock.mockResolvedValue({ id: "snap" });
  });

  it("captures each investor with positions", async () => {
    const result = await captureAllInvestorNavSnapshots(new Date("2026-06-25T10:00:00Z"));
    expect(result).toEqual({ captured: 2, skipped: 0 });
    expect(navSnapshotUpsertMock).toHaveBeenCalledTimes(2);
  });
});

describe("loadHourlyValueSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps prisma rows to HourlyValueSnapshot", async () => {
    const since = new Date("2026-06-01T00:00:00Z");
    navSnapshotFindManyMock.mockResolvedValue([
      { takenAt: new Date("2026-06-02T10:00:00Z"), valueUsdc: 11 },
      { takenAt: new Date("2026-06-02T11:00:00Z"), valueUsdc: 11.01 },
    ]);

    const rows = await loadHourlyValueSnapshots("inv-1", since);

    expect(navSnapshotFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { investorId: "inv-1", takenAt: { gte: since } },
      }),
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]?.valueUsdc).toBe(11.01);
  });

  it("returns empty array when InvestorNavSnapshot table is missing (P2021)", async () => {
    navSnapshotFindManyMock.mockRejectedValue(
      Object.assign(new Error("table does not exist"), { code: "P2021" }),
    );

    const rows = await loadHourlyValueSnapshots("inv-1", new Date("2026-06-01T00:00:00Z"));

    expect(rows).toEqual([]);
  });
});

describe("reconstructInvestorNavSeries", () => {
  const NOW = new Date("2026-06-28T00:00:00Z");
  const SINCE = new Date("2025-06-28T00:00:00Z"); // 1 year before NOW

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when the investor has no contributing position (zero stays zero)", async () => {
    positionFindManyMock.mockResolvedValue([]);
    await expect(reconstructInvestorNavSeries("inv-1", SINCE, NOW)).resolves.toEqual([]);
  });

  it("climbs deterministically from zero to the real current NAV", async () => {
    const subscribedAt = new Date("2026-03-30T00:00:00Z"); // ~90d before NOW
    positionFindManyMock.mockResolvedValue([
      { principalUsdc: 500000, accruedYieldUsdc: 9800, subscribedAt },
    ]);

    const series = await reconstructInvestorNavSeries("inv-1", SINCE, NOW);

    expect(series.length).toBeGreaterThanOrEqual(2);
    // Climbs from ZERO at subscription...
    expect(series[0]?.valueUsdc).toBe(0);
    // ...up to the current real NAV (principal + accrued) at now.
    expect(series[series.length - 1]?.valueUsdc).toBe(509800);
    // Monotonic non-decreasing, never above the real current NAV.
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i]!.valueUsdc).toBeGreaterThanOrEqual(series[i - 1]!.valueUsdc);
      expect(series[i]!.valueUsdc).toBeLessThanOrEqual(509800);
    }
  });

  it("is deterministic — identical inputs produce an identical series", async () => {
    const subscribedAt = new Date("2026-03-30T00:00:00Z");
    const row = { principalUsdc: 500000, accruedYieldUsdc: 9800, subscribedAt };

    positionFindManyMock.mockResolvedValue([row]);
    const a = await reconstructInvestorNavSeries("inv-1", SINCE, NOW);
    positionFindManyMock.mockResolvedValue([row]);
    const b = await reconstructInvestorNavSeries("inv-1", SINCE, NOW);

    expect(a).toEqual(b);
  });

  it("starts at zero and a later deposit contributes 0 before its subscription", async () => {
    positionFindManyMock.mockResolvedValue([
      { principalUsdc: 100, accruedYieldUsdc: 10, subscribedAt: new Date("2025-12-28T00:00:00Z") },
      { principalUsdc: 50, accruedYieldUsdc: 5, subscribedAt: new Date("2026-05-28T00:00:00Z") },
    ]);

    const series = await reconstructInvestorNavSeries("inv-1", SINCE, NOW);

    // Climbs from zero (earliest subscription, ratio 0).
    expect(series[0]?.valueUsdc).toBe(0);
    // Final point = both positions at full current value: 110 + 55 = 165.
    expect(series[series.length - 1]?.valueUsdc).toBe(165);
  });

  it("returns a single current-NAV point for very fresh subscriptions (<24h)", async () => {
    const subscribedAt = new Date("2026-06-27T23:30:00Z"); // 30 min before NOW
    positionFindManyMock.mockResolvedValue([
      { principalUsdc: 250000, accruedYieldUsdc: 0, subscribedAt },
    ]);

    const series = await reconstructInvestorNavSeries("inv-1", SINCE, NOW);

    expect(series).toHaveLength(1);
    expect(series[0]?.at.toISOString()).toBe(NOW.toISOString());
    expect(series[0]?.valueUsdc).toBe(250000);
  });
});
