import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Force the Postgres branch so the SQL path runs in the test.
const { providerMock } = vi.hoisted(() => ({
  providerMock: vi.fn(() => "postgresql" as "postgresql" | "sqlite"),
}));
vi.mock("@/lib/prisma-provider-resolve", () => ({
  resolvePrismaProvider: () => providerMock(),
}));

// Fake durable table backing groupBy / $queryRaw / findMany from one row set.
interface Row {
  createdAt: Date;
  outcome: string;
  kind: string;
  matchedRuleIds: string[];
}
const { rows, groupByMock, queryRawMock, findManyMock } = vi.hoisted(() => ({
  rows: [] as Row[],
  groupByMock: vi.fn(),
  queryRawMock: vi.fn(),
  findManyMock: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    agenticRouterDecisionTrace: {
      groupBy: groupByMock,
      findMany: findManyMock,
    },
    $queryRaw: queryRawMock,
  },
}));
// Prisma.sql tagged template — return the strings array so our $queryRaw mock can
// compute against the live `rows`.
vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
  },
}));

import { readDurableRouterDecisionAggregates } from "@/lib/agentic/observability/db-aggregates";
import { computeRouterDecisionStats } from "@/lib/agentic/observability/stats";
import {
  buildRouterDecisionTrendBuckets,
  getTopMatchedRules,
} from "@/lib/agentic/observability/trends";
import { windowCutoff } from "@/lib/agentic/observability/db-store";
import type {
  RouterDecisionTrace,
  RouterObservabilityWindow,
} from "@/lib/agentic/observability/types";

const NOW = new Date("2026-06-25T12:00:00.000Z");

function asTrace(r: Row): RouterDecisionTrace {
  return {
    id: `t-${r.createdAt.toISOString()}-${r.outcome}`,
    createdAt: r.createdAt.toISOString(),
    kind: r.kind,
    actionPolicy: "x",
    negated: false,
    matchedRuleIds: r.matchedRuleIds,
    prohibitedAutonomousAction: false,
    outcome: r.outcome as RouterDecisionTrace["outcome"],
    usedLegacyFallback: false,
    tookFastPath: false,
    source: "cockpit_chat",
  };
}

// Wire the mocks to compute over `rows` the SAME way Postgres would, so the
// projection logic in db-aggregates is what we're testing (not the SQL itself).
beforeEach(() => {
  rows.length = 0;
  providerMock.mockReturnValue("postgresql");
  vi.clearAllMocks();

  groupByMock.mockImplementation(
    async (args: { by: string[]; where: { createdAt: { gte: Date } } }) => {
      const gte = args.where.createdAt.gte;
      const field = args.by[0] as "outcome" | "kind";
      const counts = new Map<string, number>();
      for (const r of rows) {
        if (r.createdAt < gte) continue;
        const key = r[field];
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()].map(([k, n]) => ({
        [field]: k,
        _count: { _all: n },
      }));
    },
  );

  // $queryRaw: replicate the bucket index math the in-memory builder uses.
  queryRawMock.mockImplementation(async (q: { values: unknown[] }) => {
    // values order in db-aggregates: [startEpochSec, bucketSec, cutoff, upper]
    const [startEpochSec, bucketSec, cutoff, upper] = q.values as [
      number,
      number,
      Date,
      Date,
    ];
    const acc = new Map<string, number>();
    for (const r of rows) {
      if (r.createdAt < cutoff || r.createdAt >= upper) continue;
      const idx = Math.floor(
        (r.createdAt.getTime() / 1000 - startEpochSec) / bucketSec,
      );
      const key = `${idx}::${r.outcome}`;
      acc.set(key, (acc.get(key) ?? 0) + 1);
    }
    return [...acc.entries()].map(([key, n]) => {
      const [idx, outcome] = key.split("::");
      return { idx: Number(idx), outcome, n };
    });
  });

  findManyMock.mockImplementation(
    async (args: { where: { createdAt: { gte: Date } }; take: number }) => {
      const gte = args.where.createdAt.gte;
      return rows
        .filter((r) => r.createdAt >= gte)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, args.take)
        .map((r) => ({ matchedRuleIds: r.matchedRuleIds }));
    },
  );
});

/** Build a fixture set spread across a window for parity comparison. */
function fixture(window: RouterObservabilityWindow): Row[] {
  const cut = windowCutoff(window, NOW.getTime()).getTime();
  const span = NOW.getTime() - cut;
  const mk = (fracFromStart: number, outcome: string, rule: string): Row => ({
    createdAt: new Date(cut + Math.floor(span * fracFromStart)),
    outcome,
    kind: outcome === "nav_fast_path" ? "navigation" : "education",
    matchedRuleIds: [rule],
  });
  return [
    mk(0.05, "nav_fast_path", "nav.resolver"),
    mk(0.1, "nav_fast_path", "nav.resolver"),
    mk(0.4, "dangerous_refusal", "deploy.go_live"),
    mk(0.5, "educational_llm", "edu.yield"),
    mk(0.6, "negated_no_nav", "nav.resolver"),
    mk(0.7, "normal_llm", "none"),
    mk(0.8, "unknown", "none"),
    mk(0.95, "legacy_fallback_nav", "nav.resolver"),
  ];
}

describe("readDurableRouterDecisionAggregates — SQL/in-memory parity", () => {
  for (const window of ["1h", "24h", "7d", "30d"] as RouterObservabilityWindow[]) {
    it(`${window}: SQL stats/buckets/top-rules equal the in-memory output`, async () => {
      rows.push(...fixture(window));
      const agg = await readDurableRouterDecisionAggregates({
        window,
        now: NOW,
        topRulesLimit: 8,
      });
      expect(agg.ok).toBe(true);

      const inMemTraces = rows.map(asTrace);
      const expectedStats = computeRouterDecisionStats(inMemTraces);
      const expectedBuckets = buildRouterDecisionTrendBuckets(
        inMemTraces,
        window,
        NOW,
      );
      const expectedTop = getTopMatchedRules(inMemTraces, 8);

      expect(agg.stats).toEqual(expectedStats);
      expect(agg.trendBuckets).toEqual(expectedBuckets);
      expect(agg.topMatchedRules).toEqual(expectedTop);
    });
  }

  it("zero rows → zero buckets + empty stats", async () => {
    const agg = await readDurableRouterDecisionAggregates({
      window: "24h",
      now: NOW,
    });
    expect(agg.ok).toBe(true);
    expect(agg.stats.total).toBe(0);
    expect(agg.trendBuckets).toHaveLength(24);
    expect(agg.trendBuckets.every((b) => b.total === 0)).toBe(true);
    expect(agg.topMatchedRules).toEqual([]);
  });

  it("declines (ok:false) on a non-Postgres provider", async () => {
    providerMock.mockReturnValue("sqlite");
    const agg = await readDurableRouterDecisionAggregates({
      window: "24h",
      now: NOW,
    });
    expect(agg.ok).toBe(false);
    expect(agg.trendBuckets).toEqual([]);
  });

  it("falls back (ok:false) when the SQL query throws", async () => {
    rows.push(...fixture("24h"));
    queryRawMock.mockRejectedValue(new Error("db down"));
    const agg = await readDurableRouterDecisionAggregates({
      window: "24h",
      now: NOW,
    });
    expect(agg.ok).toBe(false);
  });

  it("only reads safe columns (no user-text fields selected)", async () => {
    rows.push(...fixture("24h"));
    await readDurableRouterDecisionAggregates({ window: "24h", now: NOW });
    // groupBy by outcome/kind only; findMany selects matchedRuleIds only.
    const groupByArgs = groupByMock.mock.calls.map((c) => c[0].by[0]);
    expect(groupByArgs).toEqual(expect.arrayContaining(["outcome", "kind"]));
    const selectArg = findManyMock.mock.calls[0]![0].select;
    expect(Object.keys(selectArg)).toEqual(["matchedRuleIds"]);
  });
});
