import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getRedisMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/rate-limit", () => ({ getRedis: () => getRedisMock() }));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// In-memory fake durable table.
interface Row {
  id: string;
  createdAt: Date;
  chatId: string | null;
  messageId: string | null;
  source: string;
  kind: string;
  actionPolicy: string;
  confidence: number | null;
  negated: boolean;
  matchedRuleIds: unknown;
  routeKey: string | null;
  educationalKind: string | null;
  prohibitedAutonomousAction: boolean;
  outcome: string;
  usedLegacyFallback: boolean;
  tookFastPath: boolean;
}
let rows: Row[] = [];
let dbThrows = false;

vi.mock("@/lib/db", () => ({
  prisma: {
    agenticRouterDecisionTrace: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        if (dbThrows) throw new Error("db down");
        rows.push(data);
        return data;
      }),
      findMany: vi.fn(
        async ({
          where,
          take,
        }: {
          where?: { createdAt?: { gte?: Date } };
          orderBy?: unknown;
          take?: number;
        }) => {
          if (dbThrows) throw new Error("db down");
          const gte = where?.createdAt?.gte;
          let out = rows.slice();
          if (gte) out = out.filter((r) => r.createdAt >= gte);
          out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return out.slice(0, take ?? out.length);
        },
      ),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

import {
  getRouterObservabilitySummary,
  resolveWindow,
} from "@/lib/agentic/observability/read-router-decisions";
import { recordRouterDecisionSafe } from "@/lib/agentic/observability/record-router-decision";
import { __resetRouterDecisionMemBuffer } from "@/lib/agentic/observability/store";
import { classifyAgenticIntent } from "@/lib/agentic/intent-router";

const classify = (m: string) =>
  classifyAgenticIntent(m, { navProfile: "lp", isAdmin: false });

beforeEach(() => {
  __resetRouterDecisionMemBuffer();
  getRedisMock.mockReturnValue(null);
  rows = [];
  dbThrows = false;
  vi.clearAllMocks();
});
afterEach(() => __resetRouterDecisionMemBuffer());

describe("resolveWindow", () => {
  it("accepts 1h/24h/7d, defaults to 24h otherwise", () => {
    expect(resolveWindow("1h")).toBe("1h");
    expect(resolveWindow("7d")).toBe("7d");
    expect(resolveWindow("bogus")).toBe("24h");
    expect(resolveWindow(undefined)).toBe("24h");
  });
});

describe("getRouterObservabilitySummary — durable v1", () => {
  it("storage 'durable' + state 'empty' when DB reachable but no rows", async () => {
    const s = await getRouterObservabilitySummary({ window: "24h" });
    expect(s.storage).toBe("durable");
    expect(s.state).toBe("empty");
    expect(s.window).toBe("24h");
    expect(s.recent).toHaveLength(0);
    expect(s.safetyNote).toMatch(/no prompts/i);
  });

  it("storage 'durable' + state 'enabled' with stats + top rules", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    await recordRouterDecisionSafe({
      decision: classify("déploie ce produit"),
      outcome: "dangerous_refusal",
      turnId: "t2",
    });
    const s = await getRouterObservabilitySummary({ window: "24h" });
    expect(s.storage).toBe("durable");
    expect(s.state).toBe("enabled");
    expect(s.stats.total).toBe(2);
    expect(s.stats.navigationFastPaths).toBe(1);
    expect(s.stats.dangerousRefusals).toBe(1);
    expect(s.topMatchedRules.length).toBeGreaterThan(0);
  });

  it("time window filters out older rows", async () => {
    // Insert one row 2 days ago directly into the fake table.
    rows.push({
      id: "old",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      chatId: null,
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
    });
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "fresh",
    });
    const h1 = await getRouterObservabilitySummary({ window: "1h" });
    expect(h1.stats.total).toBe(1); // only the fresh one
    const d7 = await getRouterObservabilitySummary({ window: "7d" });
    expect(d7.stats.total).toBe(2); // both
  });

  it("falls back to redis/memory when DB read fails", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    dbThrows = true; // now both create + findMany throw
    const s = await getRouterObservabilitySummary({ window: "24h" });
    expect(["redis_fallback", "memory_fallback"]).toContain(s.storage);
  });
});
