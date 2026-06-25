import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { findManyMock, deleteManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  deleteManyMock: vi.fn(async (_args: unknown) => ({ count: 0 })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    agenticRouterDecisionTrace: {
      findMany: findManyMock,
      deleteMany: deleteManyMock,
      create: vi.fn(),
    },
  },
}));

// env is read by getRetentionConfig — control OBS_RETENTION_DAYS per test.
vi.mock("@/lib/env", () => ({
  env: {
    get OBS_RETENTION_DAYS() {
      const v = process.env.__TEST_OBS_RETENTION_DAYS;
      return v ? Number(v) : undefined;
    },
  },
}));

import {
  durableAggregateByDay,
  getRetentionConfig,
  pruneOldTraces,
  DURABLE_RETENTION_DAYS,
} from "@/lib/agentic/observability/db-store";

const NOW = Date.parse("2026-06-25T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.__TEST_OBS_RETENTION_DAYS;
});
afterEach(() => {
  delete process.env.__TEST_OBS_RETENTION_DAYS;
});

describe("getRetentionConfig", () => {
  it("defaults to the built-in horizon when OBS_RETENTION_DAYS is unset", () => {
    const c = getRetentionConfig();
    expect(c.retentionDays).toBe(DURABLE_RETENTION_DAYS);
    expect(c.fromEnv).toBe(false);
  });

  it("uses OBS_RETENTION_DAYS when set", () => {
    process.env.__TEST_OBS_RETENTION_DAYS = "14";
    const c = getRetentionConfig();
    expect(c.retentionDays).toBe(14);
    expect(c.fromEnv).toBe(true);
  });
});

describe("pruneOldTraces", () => {
  it("deletes rows older than the effective retention horizon", async () => {
    process.env.__TEST_OBS_RETENTION_DAYS = "30";
    await pruneOldTraces(NOW);
    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    const arg = deleteManyMock.mock.calls[0]![0] as {
      where: { createdAt: { lt: Date } };
    };
    const expectedCutoff = NOW - 30 * 24 * 60 * 60 * 1000;
    expect(arg.where.createdAt.lt.getTime()).toBe(expectedCutoff);
  });
});

describe("durableAggregateByDay", () => {
  it("buckets rows into per-UTC-day outcome counts, oldest first", async () => {
    findManyMock.mockResolvedValue([
      { createdAt: new Date("2026-06-24T09:00:00.000Z"), outcome: "nav_fast_path" },
      { createdAt: new Date("2026-06-24T18:00:00.000Z"), outcome: "dangerous_refusal" },
      { createdAt: new Date("2026-06-25T08:00:00.000Z"), outcome: "educational_llm" },
      { createdAt: new Date("2026-06-25T09:00:00.000Z"), outcome: "normal_llm" },
      { createdAt: new Date("2026-06-25T10:00:00.000Z"), outcome: "legacy_fallback_nav" },
    ]);

    const { ok, days } = await durableAggregateByDay({ horizonDays: 3, now: NOW });
    expect(ok).toBe(true);
    expect(days).toHaveLength(3); // seeded: 06-23, 06-24, 06-25
    expect(days.map((d) => d.date)).toEqual([
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
    ]);

    const d24 = days.find((d) => d.date === "2026-06-24")!;
    expect(d24.total).toBe(2);
    expect(d24.navigationFastPaths).toBe(1);
    expect(d24.dangerousRefusals).toBe(1);

    const d25 = days.find((d) => d.date === "2026-06-25")!;
    expect(d25.total).toBe(3);
    expect(d25.educationalTurns).toBe(1);
    // normal_llm + legacy_fallback_nav → normalOrUnknown
    expect(d25.normalOrUnknown).toBe(2);

    const d23 = days.find((d) => d.date === "2026-06-23")!;
    expect(d23.total).toBe(0); // gap day seeded to zero
  });

  it("clamps the horizon to the retention window", async () => {
    process.env.__TEST_OBS_RETENTION_DAYS = "5";
    findManyMock.mockResolvedValue([]);
    const { days } = await durableAggregateByDay({ horizonDays: 90, now: NOW });
    expect(days).toHaveLength(5); // clamped to retention
  });

  it("returns ok=false (no throw) when the DB read fails", async () => {
    findManyMock.mockRejectedValue(new Error("table missing"));
    const res = await durableAggregateByDay({ horizonDays: 7, now: NOW });
    expect(res.ok).toBe(false);
    expect(res.days).toEqual([]);
  });

  it("queries with a narrow projection (createdAt + outcome only)", async () => {
    findManyMock.mockResolvedValue([]);
    await durableAggregateByDay({ horizonDays: 7, now: NOW });
    const arg = findManyMock.mock.calls[0]![0] as { select: object };
    expect(arg.select).toEqual({ createdAt: true, outcome: true });
  });
});
