import "server-only";

// Router Observability v1.2 — SQL aggregate read path (durable, O(buckets)).
//
// Replaces the v1.1 "load up to 5000 rows then aggregate in memory" path with
// DB-side aggregation when the durable store is available:
//   - stats:   prisma.groupBy by outcome + by kind (works on both providers)
//   - buckets: a parameterized Postgres $queryRaw that buckets by index, GROUPed
//              by (bucketIndex, outcome) — projected into the SAME slots the
//              in-memory builder produces (byte-identical UI output)
//   - topRules: matchedRuleIds is a JSON array → derived in-memory from a SMALL
//              bounded read (documented; not raw JSON SQL)
//
// SAFETY: read-only. SELECTs touch only createdAt / outcome / kind / matchedRuleIds
// — never user text, prompts, or tool payloads. The raw query is fully
// parameterized (cutoff, start-epoch, bucket-seconds are numeric/timestamp
// params); identifiers are hardcoded constants, not user input. Every function is
// best-effort: on any failure it returns `ok: false` so the caller falls back to
// the in-memory path. NEVER throws into the chat flow.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { resolvePrismaProvider } from "@/lib/prisma-provider-resolve";
import {
  buildEmptyTrendBuckets,
  getTopMatchedRules,
  trendCategoryKeyForOutcome,
} from "./trends";
import { windowCutoff } from "./db-store";
import type {
  RouterDecisionStats,
  RouterDecisionTrendBucket,
  RouterMatchedRuleStat,
  RouterObservabilityWindow,
} from "./types";

/** How many rows to read for the in-memory top-rules derivation (bounded). */
const TOP_RULES_SCAN_LIMIT = 2000;

export interface DurableAggregatesResult {
  ok: boolean;
  stats: RouterDecisionStats;
  trendBuckets: RouterDecisionTrendBucket[];
  topMatchedRules: RouterMatchedRuleStat[];
}

const EMPTY_STATS: RouterDecisionStats = {
  total: 0,
  byKind: {},
  byOutcome: {},
  dangerousRefusals: 0,
  negatedNoNav: 0,
  educationalTurns: 0,
  navigationFastPaths: 0,
  legacyFallbacks: 0,
  unknownTurns: 0,
};

/** Coerce a Prisma `_count` / raw count (number | bigint) to a JS number. */
function toCount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Outcome + kind counts via prisma.groupBy (cross-provider). Builds the same
 * RouterDecisionStats shape computeRouterDecisionStats produces — using the SAME
 * outcome categorization — so the stat cards are identical.
 */
async function aggregateStats(cutoff: Date): Promise<RouterDecisionStats> {
  const [byOutcomeRows, byKindRows] = await Promise.all([
    prisma.agenticRouterDecisionTrace.groupBy({
      by: ["outcome"],
      where: { createdAt: { gte: cutoff } },
      _count: { _all: true },
    }),
    prisma.agenticRouterDecisionTrace.groupBy({
      by: ["kind"],
      where: { createdAt: { gte: cutoff } },
      _count: { _all: true },
    }),
  ]);

  const stats: RouterDecisionStats = {
    total: 0,
    byKind: {},
    byOutcome: {},
    dangerousRefusals: 0,
    negatedNoNav: 0,
    educationalTurns: 0,
    navigationFastPaths: 0,
    legacyFallbacks: 0,
    unknownTurns: 0,
  };

  for (const row of byOutcomeRows) {
    const n = toCount(row._count?._all);
    stats.byOutcome[row.outcome] = (stats.byOutcome[row.outcome] ?? 0) + n;
    stats.total += n;
    switch (row.outcome) {
      case "dangerous_refusal":
        stats.dangerousRefusals += n;
        break;
      case "negated_no_nav":
        stats.negatedNoNav += n;
        break;
      case "educational_llm":
        stats.educationalTurns += n;
        break;
      case "nav_fast_path":
        stats.navigationFastPaths += n;
        break;
      case "legacy_fallback_nav":
        stats.legacyFallbacks += n;
        break;
      case "unknown":
        stats.unknownTurns += n;
        break;
      default:
        break; // normal_llm → total / byOutcome only
    }
  }

  for (const row of byKindRows) {
    stats.byKind[row.kind] = (stats.byKind[row.kind] ?? 0) + toCount(row._count?._all);
  }

  return stats;
}

/** One raw bucket row: floor((epoch(createdAt) - startEpoch) / bucketSeconds). */
interface RawBucketRow {
  idx: number | bigint | string;
  outcome: string;
  n: number | bigint | string;
}

/**
 * Postgres-only: group rows into bucket slots by index, GROUP BY (idx, outcome).
 * The index math mirrors the in-memory builder exactly:
 *   idx = floor((epoch(createdAt) - startEpoch) / bucketSeconds)
 * Rows at/after `now` (idx >= bucketCount) are excluded by the index range. The
 * `_int` casts keep the counts as JS numbers (Postgres count() is bigint).
 */
async function aggregateBucketsPostgres(
  window: RouterObservabilityWindow,
  now: Date,
): Promise<RouterDecisionTrendBucket[]> {
  // Build the empty slots first, then derive the geometry from THEM so the SQL
  // index math is pinned to the exact same start/span the slots use.
  const buckets = buildEmptyTrendBuckets(window, now);
  const bucketCount = buckets.length;
  if (bucketCount === 0) return buckets;

  const nowMs = now.getTime();
  const startMs = Date.parse(buckets[0]!.start);
  const span = Date.parse(buckets[0]!.end) - startMs;
  if (span <= 0) return buckets;

  const startEpochSec = startMs / 1000;
  const bucketSec = span / 1000;
  const cutoff = new Date(startMs);
  const upper = new Date(nowMs);

  const rows = await prisma.$queryRaw<RawBucketRow[]>(Prisma.sql`
    SELECT
      floor((extract(epoch from "createdAt") - ${startEpochSec}::double precision)
            / ${bucketSec}::double precision)::int AS idx,
      "outcome" AS outcome,
      count(*)::int AS n
    FROM "AgenticRouterDecisionTrace"
    WHERE "createdAt" >= ${cutoff} AND "createdAt" < ${upper}
    GROUP BY idx, "outcome"
  `);

  for (const row of rows) {
    const idx = toCount(row.idx);
    if (idx < 0 || idx >= bucketCount) continue; // defensive: outside the window
    const bucket = buckets[idx];
    if (!bucket) continue;
    const n = toCount(row.n);
    bucket.total += n;
    bucket[trendCategoryKeyForOutcome(row.outcome)] += n;
  }

  return buckets;
}

/**
 * Top matched rules via a bounded in-memory derivation: matchedRuleIds is a JSON
 * array column, so we read only `{matchedRuleIds}` for the most recent rows in the
 * window (capped) and tally in memory. Documented limitation: with very high
 * volume the top-rules reflect the most recent TOP_RULES_SCAN_LIMIT decisions in
 * the window, not the entire window. No raw JSON SQL (provider-portable + safe).
 */
async function aggregateTopRules(
  cutoff: Date,
  limit: number,
): Promise<RouterMatchedRuleStat[]> {
  const rows = await prisma.agenticRouterDecisionTrace.findMany({
    where: { createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
    take: TOP_RULES_SCAN_LIMIT,
    select: { matchedRuleIds: true },
  });
  const traces = rows.map((r) => ({
    // Minimal shape getTopMatchedRules needs.
    matchedRuleIds: Array.isArray(r.matchedRuleIds)
      ? (r.matchedRuleIds as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
  })) as Parameters<typeof getTopMatchedRules>[0];
  return getTopMatchedRules(traces, limit);
}

/**
 * Read durable aggregates (stats + trend buckets + top rules) via SQL. Returns
 * `ok: false` (with empty data) on ANY failure — incl. a non-Postgres provider
 * (sqlite/tests) where the raw bucket query isn't supported — so the caller falls
 * back to the in-memory path. NEVER throws.
 */
export async function readDurableRouterDecisionAggregates(options: {
  window: RouterObservabilityWindow;
  now?: Date;
  topRulesLimit?: number;
}): Promise<DurableAggregatesResult> {
  const now = options.now ?? new Date();
  const topRulesLimit = options.topRulesLimit ?? 8;

  // The bucket query uses Postgres-specific epoch arithmetic. On any other
  // provider (sqlite for local/tests) we decline so the caller uses the in-memory
  // path — which is correct everywhere.
  if (resolvePrismaProvider() !== "postgresql") {
    return { ok: false, stats: EMPTY_STATS, trendBuckets: [], topMatchedRules: [] };
  }

  try {
    const cutoff = windowCutoff(options.window, now.getTime());
    const [stats, trendBuckets, topMatchedRules] = await Promise.all([
      aggregateStats(cutoff),
      aggregateBucketsPostgres(options.window, now),
      aggregateTopRules(cutoff, topRulesLimit),
    ]);
    return { ok: true, stats, trendBuckets, topMatchedRules };
  } catch (err) {
    logger.warn(
      "router-observability: SQL aggregate read failed (will fall back to in-memory)",
      {},
      err instanceof Error ? err : undefined,
    );
    return { ok: false, stats: EMPTY_STATS, trendBuckets: [], topMatchedRules: [] };
  }
}
