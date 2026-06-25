import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// env seam — override ROUTER_TRACE_RETENTION_DAYS per test.
const { envObj } = vi.hoisted(() => ({
  envObj: { ROUTER_TRACE_RETENTION_DAYS: undefined as number | undefined },
}));
vi.mock("@/lib/env", () => ({ env: envObj }));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { countMock, deleteManyMock } = vi.hoisted(() => ({
  countMock: vi.fn(async (_args: unknown) => 0),
  deleteManyMock: vi.fn(async (_args: unknown) => ({ count: 0 })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    agenticRouterDecisionTrace: {
      count: countMock,
      deleteMany: deleteManyMock,
    },
  },
}));

import {
  getRouterTraceRetentionDays,
  getRouterTraceRetentionCutoff,
  pruneRouterDecisionTraces,
  DURABLE_RETENTION_DAYS,
} from "@/lib/agentic/observability/retention";

const NOW = new Date("2026-06-25T12:00:00.000Z");

beforeEach(() => {
  envObj.ROUTER_TRACE_RETENTION_DAYS = undefined;
  vi.clearAllMocks();
});
afterEach(() => {
  envObj.ROUTER_TRACE_RETENTION_DAYS = undefined;
});

describe("getRouterTraceRetentionDays", () => {
  it("defaults to 90 when unset", () => {
    expect(DURABLE_RETENTION_DAYS).toBe(90);
    expect(getRouterTraceRetentionDays()).toBe(90);
  });

  it("honours a valid env override", () => {
    envObj.ROUTER_TRACE_RETENTION_DAYS = 45;
    expect(getRouterTraceRetentionDays()).toBe(45);
  });

  it("clamps an out-of-range override (boot-safe, never breaks)", () => {
    envObj.ROUTER_TRACE_RETENTION_DAYS = 5; // below min 7
    expect(getRouterTraceRetentionDays()).toBe(7);
    envObj.ROUTER_TRACE_RETENTION_DAYS = 99999; // above max 730
    expect(getRouterTraceRetentionDays()).toBe(730);
  });

  it("falls back to default for a non-finite value", () => {
    envObj.ROUTER_TRACE_RETENTION_DAYS = NaN;
    expect(getRouterTraceRetentionDays()).toBe(90);
  });
});

describe("getRouterTraceRetentionCutoff", () => {
  it("computes now - retentionDays", () => {
    const cutoff = getRouterTraceRetentionCutoff(NOW);
    expect(NOW.getTime() - cutoff.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe("pruneRouterDecisionTraces", () => {
  it("DEFAULTS to dry-run: counts, never deletes", async () => {
    countMock.mockResolvedValue(7);
    const res = await pruneRouterDecisionTraces({ now: NOW });
    expect(res.dryRun).toBe(true);
    expect(res.deleted).toBe(7);
    expect(res.retentionDays).toBe(90);
    expect(res.cutoff).toBe(getRouterTraceRetentionCutoff(NOW).toISOString());
    expect(countMock).toHaveBeenCalledTimes(1);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("deletes only when dryRun:false is explicit", async () => {
    deleteManyMock.mockResolvedValue({ count: 3 });
    const res = await pruneRouterDecisionTraces({ dryRun: false, now: NOW });
    expect(res.dryRun).toBe(false);
    expect(res.deleted).toBe(3);
    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    expect(countMock).not.toHaveBeenCalled();
  });

  it("never throws on DB failure — returns deleted 0", async () => {
    countMock.mockRejectedValue(new Error("db down"));
    const res = await pruneRouterDecisionTraces({ now: NOW });
    expect(res.deleted).toBe(0);
    expect(res.dryRun).toBe(true);
  });

  it("the where clause targets rows older than the cutoff", async () => {
    countMock.mockResolvedValue(0);
    await pruneRouterDecisionTraces({ now: NOW });
    const arg = countMock.mock.calls[0]![0] as {
      where: { createdAt: { lt: Date } };
    };
    expect(arg.where.createdAt.lt.toISOString()).toBe(
      getRouterTraceRetentionCutoff(NOW).toISOString(),
    );
  });
});
