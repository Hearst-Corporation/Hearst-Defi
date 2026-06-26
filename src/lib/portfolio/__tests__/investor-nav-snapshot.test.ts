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
