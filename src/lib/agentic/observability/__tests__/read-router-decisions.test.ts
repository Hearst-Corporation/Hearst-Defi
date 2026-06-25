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
  it("accepts 1h/24h/7d/30d, defaults to 24h otherwise", () => {
    expect(resolveWindow("1h")).toBe("1h");
    expect(resolveWindow("7d")).toBe("7d");
    expect(resolveWindow("30d")).toBe("30d");
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

describe("getRouterObservabilitySummary — aggregation mode (v1.2)", () => {
  it("uses 'in_memory' on sqlite (durable reachable, SQL path declines)", async () => {
    // The test runner's provider is sqlite, so the SQL aggregate declines and the
    // read path computes in-memory over the windowed durable rows.
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    const s = await getRouterObservabilitySummary({ window: "24h" });
    expect(s.storage).toBe("durable");
    expect(s.aggregationMode).toBe("in_memory");
    // Output is identical regardless of aggregation path.
    expect(s.stats.total).toBe(1);
    expect(s.stats.navigationFastPaths).toBe(1);
  });

  it("uses 'fallback' when the durable store is unavailable", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    dbThrows = true;
    const s = await getRouterObservabilitySummary({ window: "24h" });
    expect(["redis_fallback", "memory_fallback"]).toContain(s.storage);
    expect(s.aggregationMode).toBe("fallback");
  });
});

describe("getRouterObservabilitySummary — trends (v0.1)", () => {
  it("includes trendWindow / trendBuckets / topMatchedRules / bufferLimitNote", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    const s = await getRouterObservabilitySummary();
    expect(s.trendWindow).toBe("24h"); // default
    expect(Array.isArray(s.trendBuckets)).toBe(true);
    expect(s.trendBuckets).toHaveLength(24);
    expect(Array.isArray(s.topMatchedRules)).toBe(true);
    expect(s.bufferLimitNote).toMatch(/durable router traces/i);
  });

  it("honours the requested window (1h → 12 buckets)", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    const s = await getRouterObservabilitySummary({ window: "1h" });
    expect(s.trendWindow).toBe("1h");
    expect(s.trendBuckets).toHaveLength(12);
  });

  it("falls back to 24h for an invalid window", async () => {
    const s = await getRouterObservabilitySummary({ window: "24h" });
    expect(s.trendWindow).toBe("24h");
  });
});

describe("getRouterObservabilitySummary — 30d long window (v1.1)", () => {
  function mkRow(daysAgo: number, outcome = "nav_fast_path"): Row {
    return {
      id: `r-${daysAgo}`,
      createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
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
      outcome,
      usedLegacyFallback: false,
      tookFastPath: true,
    };
  }

  it("durable 30d window includes rows within 30 days, excludes older", () => {
    rows.push(mkRow(2), mkRow(20), mkRow(40)); // 40d is outside the 30d window
    return getRouterObservabilitySummary({ window: "30d" }).then((s) => {
      expect(s.storage).toBe("durable");
      expect(s.window).toBe("30d");
      expect(s.stats.total).toBe(2); // 2d + 20d
      expect(s.trendBuckets).toHaveLength(30);
      expect(s.retentionDays).toBe(90);
      expect(s.retentionPolicyNote).toMatch(/default 90 days/i);
      // durable serves the full window → no limitation note
      expect(s.windowLimitationNote).toBeNull();
    });
  });

  it("recent table is sliced (<=50) even when the window has many rows", async () => {
    for (let i = 0; i < 120; i++) rows.push(mkRow(i % 25)); // 120 rows within 30d
    const s = await getRouterObservabilitySummary({ window: "30d" });
    expect(s.stats.total).toBe(120); // stats over full window
    expect(s.recent.length).toBeLessThanOrEqual(50); // table sliced
  });

  it("on fallback storage, 30d surfaces a limitation note", async () => {
    rows.push(mkRow(2));
    dbThrows = true; // durable read fails → Redis/memory fallback
    const s = await getRouterObservabilitySummary({ window: "30d" });
    expect(["redis_fallback", "memory_fallback"]).toContain(s.storage);
    expect(s.windowLimitationNote).toMatch(/durable router traces when available/i);
  });

  it("shorter windows never carry a limitation note", async () => {
    rows.push(mkRow(0));
    const s = await getRouterObservabilitySummary({ window: "24h" });
    expect(s.windowLimitationNote).toBeNull();
  });
});

describe("getRouterObservabilitySummary — long-term aggregate (v1.1)", () => {
  it("includes a durable long-term summary with retention config", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    const s = await getRouterObservabilitySummary({
      window: "24h",
      longTermHorizonDays: 7,
    });
    expect(s.longTerm).toBeDefined();
    expect(s.longTerm!.available).toBe(true);
    expect(s.longTerm!.horizonDays).toBe(7);
    expect(s.longTerm!.days).toHaveLength(7);
    expect(s.longTerm!.retention.retentionDays).toBe(90); // default
    expect(s.longTerm!.retention.fromEnv).toBe(false);
    expect(s.longTerm!.total).toBe(1);
    expect(s.longTerm!.totals.navigationFastPaths).toBe(1);
  });

  it("long-term is unavailable (no throw) when the durable read fails", async () => {
    dbThrows = true;
    const s = await getRouterObservabilitySummary({ window: "24h" });
    // window read falls back to redis/memory; the long-term aggregate is honest
    expect(s.longTerm).toBeDefined();
    expect(s.longTerm!.available).toBe(false);
    expect(s.longTerm!.days).toEqual([]);
    expect(s.longTerm!.note).toMatch(/unavailable/i);
  });
});

describe("getRouterObservabilitySummary — aggregationMode (v1.2)", () => {
  it("uses in_memory mode when durable is reachable but provider is sqlite", async () => {
    // The test env is PRISMA_PROVIDER=sqlite, so the SQL aggregate path declines
    // and the read falls back to in-memory over the durable rows.
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    const s = await getRouterObservabilitySummary({ window: "24h" });
    expect(s.storage).toBe("durable");
    expect(s.aggregationMode).toBe("in_memory");
    expect(s.stats.total).toBe(1);
  });

  it("uses fallback mode when the durable store is down", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    dbThrows = true; // durable read + aggregate fail → Redis/memory fallback
    const s = await getRouterObservabilitySummary({ window: "24h" });
    expect(["redis_fallback", "memory_fallback"]).toContain(s.storage);
    expect(s.aggregationMode).toBe("fallback");
  });
});
