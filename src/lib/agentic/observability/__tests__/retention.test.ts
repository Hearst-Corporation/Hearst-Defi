import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// db-store seam: the slim retention helper delegates the effective-days + cutoff
// + count/delete to db-store (which owns OBS_RETENTION_DAYS via getRetentionConfig).
const { countMock, deleteMock, retentionDaysMock, cutoffMock } = vi.hoisted(() => ({
  countMock: vi.fn(async (_now?: number) => 0),
  deleteMock: vi.fn(async (_now?: number) => 0),
  retentionDaysMock: vi.fn(() => 90),
  cutoffMock: vi.fn((now: Date) => new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)),
}));
vi.mock("@/lib/agentic/observability/db-store", () => ({
  getRouterTraceRetentionDays: retentionDaysMock,
  getRouterTraceRetentionCutoff: cutoffMock,
  countTracesOlderThanRetention: countMock,
  deleteTracesOlderThanRetention: deleteMock,
}));

import { pruneRouterDecisionTraces } from "@/lib/agentic/observability/retention";

const NOW = new Date("2026-06-25T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  retentionDaysMock.mockReturnValue(90);
  cutoffMock.mockImplementation(
    (now: Date) => new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
  );
});

describe("pruneRouterDecisionTraces", () => {
  it("DEFAULTS to dry-run: counts, never deletes", async () => {
    countMock.mockResolvedValue(7);
    const res = await pruneRouterDecisionTraces({ now: NOW });
    expect(res.dryRun).toBe(true);
    expect(res.deleted).toBe(7);
    expect(res.retentionDays).toBe(90);
    expect(res.cutoff).toBe(cutoffMock(NOW).toISOString());
    expect(countMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes only when dryRun:false is explicit", async () => {
    deleteMock.mockResolvedValue(3);
    const res = await pruneRouterDecisionTraces({ dryRun: false, now: NOW });
    expect(res.dryRun).toBe(false);
    expect(res.deleted).toBe(3);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(countMock).not.toHaveBeenCalled();
  });

  it("reflects an env-overridden retention horizon from db-store", async () => {
    retentionDaysMock.mockReturnValue(45);
    cutoffMock.mockImplementation(
      (now: Date) => new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
    );
    countMock.mockResolvedValue(0);
    const res = await pruneRouterDecisionTraces({ now: NOW });
    expect(res.retentionDays).toBe(45);
  });

  it("never throws on DB failure — returns deleted 0", async () => {
    countMock.mockRejectedValue(new Error("db down"));
    const res = await pruneRouterDecisionTraces({ now: NOW });
    expect(res.deleted).toBe(0);
    expect(res.dryRun).toBe(true);
  });
});
