import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { createMock, findManyMock, deleteManyMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  findManyMock: vi.fn(),
  deleteManyMock: vi.fn(async (_args: unknown) => ({ count: 3 })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    agenticRouterDecisionTrace: {
      create: createMock,
      findMany: findManyMock,
      deleteMany: deleteManyMock,
    },
  },
}));

import {
  durableAppendTrace,
  durableReadTraces,
  topMatchedRules,
  pruneOldTraces,
  windowCutoff,
  DURABLE_RETENTION_DAYS,
} from "@/lib/agentic/observability/db-store";
import type { RouterDecisionTrace } from "@/lib/agentic/observability/types";

const TRACE: RouterDecisionTrace = {
  id: "rdec:turn_1",
  createdAt: "2026-06-25T10:00:00.000Z",
  chatId: "chat_1",
  kind: "navigation",
  actionPolicy: "allow_navigation",
  confidence: 0.95,
  negated: false,
  matchedRuleIds: ["nav.resolver"],
  routeKey: "vaults",
  prohibitedAutonomousAction: false,
  outcome: "nav_fast_path",
  usedLegacyFallback: false,
  tookFastPath: true,
  source: "cockpit_chat",
};

beforeEach(() => vi.clearAllMocks());

describe("windowCutoff", () => {
  it("computes the right cutoff per window", () => {
    const now = Date.parse("2026-06-25T12:00:00.000Z");
    expect(windowCutoff("1h", now).toISOString()).toBe("2026-06-25T11:00:00.000Z");
    expect(windowCutoff("24h", now).toISOString()).toBe("2026-06-24T12:00:00.000Z");
    expect(windowCutoff("7d", now).toISOString()).toBe("2026-06-18T12:00:00.000Z");
  });
});

describe("durableAppendTrace", () => {
  it("maps fields + converts createdAt to a Date; returns true", async () => {
    createMock.mockResolvedValue({});
    const ok = await durableAppendTrace(TRACE);
    expect(ok).toBe(true);
    const arg = createMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(arg.data.createdAt).toBeInstanceOf(Date);
    expect(arg.data.routeKey).toBe("vaults");
    expect(arg.data.matchedRuleIds).toEqual(["nav.resolver"]);
    // no user-text fields possible
    expect("normalizedInput" in arg.data).toBe(false);
    expect("reason" in arg.data).toBe(false);
  });

  it("returns false (no throw) on DB failure", async () => {
    createMock.mockRejectedValue(new Error("db down"));
    await expect(durableAppendTrace(TRACE)).resolves.toBe(false);
  });

  it("triggers a best-effort prune on pruneTick", async () => {
    createMock.mockResolvedValue({});
    await durableAppendTrace(TRACE, { pruneTick: true });
    // prune runs fire-and-forget; allow the microtask to flush
    await Promise.resolve();
    await Promise.resolve();
    expect(deleteManyMock).toHaveBeenCalled();
  });
});

describe("durableReadTraces", () => {
  it("queries with a window cutoff + maps rows back to ISO", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "r1",
        createdAt: new Date("2026-06-25T10:00:00.000Z"),
        chatId: "c1",
        messageId: null,
        source: "cockpit_chat",
        kind: "navigation",
        actionPolicy: "allow_navigation",
        confidence: 0.9,
        negated: false,
        matchedRuleIds: ["nav.resolver"],
        routeKey: "vaults",
        educationalKind: null,
        prohibitedAutonomousAction: false,
        outcome: "nav_fast_path",
        usedLegacyFallback: false,
        tookFastPath: true,
      },
    ]);
    const res = await durableReadTraces({ window: "24h", limit: 50 });
    expect(res.ok).toBe(true);
    expect(res.traces[0]?.createdAt).toBe("2026-06-25T10:00:00.000Z");
    const where = findManyMock.mock.calls[0]![0] as {
      where: { createdAt: { gte: Date } };
    };
    expect(where.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("returns ok=false (no throw) when the table is missing / DB down", async () => {
    findManyMock.mockRejectedValue(new Error("relation does not exist"));
    const res = await durableReadTraces({ window: "24h", limit: 50 });
    expect(res.ok).toBe(false);
    expect(res.traces).toEqual([]);
  });
});

describe("topMatchedRules", () => {
  it("ranks rule ids by frequency", () => {
    const mk = (ids: string[], i: number): RouterDecisionTrace => ({
      ...TRACE,
      id: `t${i}`,
      matchedRuleIds: ids,
    });
    const top = topMatchedRules(
      [
        mk(["a", "b"], 1),
        mk(["a"], 2),
        mk(["a", "c"], 3),
        mk(["b"], 4),
      ],
      2,
    );
    expect(top[0]).toEqual({ ruleId: "a", count: 3 });
    expect(top[1]).toEqual({ ruleId: "b", count: 2 });
    expect(top).toHaveLength(2);
  });
});

describe("pruneOldTraces", () => {
  it("deletes rows older than the retention horizon", async () => {
    const now = Date.parse("2026-06-25T12:00:00.000Z");
    await pruneOldTraces(now);
    const arg = deleteManyMock.mock.calls[0]![0] as {
      where: { createdAt: { lt: Date } };
    };
    const expected = new Date(now - DURABLE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    expect(arg.where.createdAt.lt.toISOString()).toBe(expected.toISOString());
  });
});
