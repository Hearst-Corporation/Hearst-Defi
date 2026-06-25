# Router Observability v1 — durable

v1 promotes [Router Observability v0](./ROUTER_OBSERVABILITY_V0.md) from a volatile
capped Redis buffer to a **durable, queryable** store with time-window filters,
surfaced read-only in `/admin/agentic`. It changes NO router/guard/HITL behaviour
and stores NO user text. One targeted Prisma table is added; no other model changes.

## v1.1 — long-window (30d) + retention policy

v1.1 adds a **30-day** window (30 daily buckets) alongside 1h/24h/7d, an
env-overridable **retention policy**, and a tested (dry-run-default) pruning helper:

- **30d window**: `?routerWindow=30d`. Stats, trends, top-rules and outcome
  distribution are computed over the full 30-day windowed read (durable DB, single
  `createdAt`-indexed query capped at 5000 rows); the recent-decisions table is
  sliced to the newest 50 from the same read (no second query). When the durable
  store is unavailable, the UI shows a `limited` note (the Redis/memory fallback
  only holds the capped 7-day recent buffer, so 30d may be incomplete).
- **Retention**: `src/lib/agentic/observability/retention.ts`. Default **90 days**,
  overridable via the non-secret env var `ROUTER_TRACE_RETENTION_DAYS`
  (`z.coerce.number().int().positive().optional()` in `env.ts`; clamped to 7–730,
  boot-safe). 30d ≤ 90d so the window never shows pruned-away data. The retention
  policy is rendered read-only in `/admin/agentic` — there is **no prune/delete
  control in the UI**.
- **Pruning helper**: `pruneRouterDecisionTraces({dryRun?, now?})` — **dry-run by
  default** (counts only, deletes nothing); a real delete needs explicit
  `dryRun:false`. Never called from the admin data loader or the chat runtime;
  the only automatic prune is the best-effort write-time tick in `db-store`
  (`~1 in 50` durable writes). No cron added. Best-effort: never throws.

## v1.2 — SQL aggregates (O(buckets), not O(rows))

v1.2 replaces the "load up to 5000 rows then aggregate in memory" path with
**DB-side aggregation** when the durable store is available — same UI, less memory.
NO schema change, NO migration, NO new table.

- **Module**: `src/lib/agentic/observability/db-aggregates.ts`
  (`readDurableRouterDecisionAggregates`). On the durable read path:
  - **stats**: `prisma.agenticRouterDecisionTrace.groupBy({ by:["outcome"] })` +
    `by:["kind"]` (cross-provider Prisma `groupBy`, O(distinct values)).
  - **trend buckets**: a **Postgres-only** parameterized `$queryRaw` that buckets
    by index — `floor((extract(epoch from "createdAt") - startEpoch) / bucketSec)` —
    `GROUP BY idx, outcome`. The index math mirrors the in-memory builder exactly,
    and the grouped counts are projected into the SAME prebuilt bucket slots
    (`buildEmptyTrendBuckets`), so the rendered bars are **byte-identical**
    (a parity test asserts `toEqual` for all 4 windows). `count(*)::int` avoids the
    Postgres bigint. The raw query is fully parameterized; identifiers are
    hardcoded constants, never user input.
  - **top matched rules**: `matchedRuleIds` is a JSON array (not groupable), so it
    is derived in-memory from a bounded `select: { matchedRuleIds }` read (cap 2000
    most-recent in window). Documented limitation; provider-portable; no raw JSON SQL.
- **The recent-decisions TABLE** is a SEPARATE small read (`take: 50`) — the
  5000-row aggregate read is **eliminated** on the durable path.
- **Fallback chain** (best-effort, never throws into chat):
  - durable + Postgres + SQL ok → `aggregationMode: "sql"`
  - durable but SQL declined/failed (e.g. sqlite/local, or a raw-query error) →
    in-memory over a windowed row read → `aggregationMode: "in_memory"`
  - durable store down → Redis/memory buffer aggregated in memory →
    `aggregationMode: "fallback"`
- **UI**: a small read-only badge shows the mode —
  *"aggregation: SQL durable aggregates"* or *"fallback in-memory"*. No redesign,
  no controls. Privacy unchanged: the aggregates read only `createdAt` / `outcome`
  / `kind` / `matchedRuleIds` — never user text.

## What changed vs v0

| | v0 | v1 |
| --- | --- | --- |
| Storage | Redis capped list (200, 7-day TTL) + memory | **Prisma `AgenticRouterDecisionTrace`** (durable) → Redis → memory fallback |
| Retention | 7-day TTL / cap 200 | best-effort prune > 90 days; reads are window-bounded |
| Query | newest-N only | **time window** (1h / 24h / 7d) + stats + top rules |
| Admin UI | status / stats / table | + window selector, storage-mode badge, outcome distribution, top matched rules |

## The migration (scope-strict)

One additive table, no other model touched, no destructive SQL:

```prisma
model AgenticRouterDecisionTrace {
  id                         String   @id @default(cuid()) // caller supplies rdec:turn_…
  createdAt                  DateTime @default(now())
  chatId                     String?
  messageId                  String?
  source                     String
  kind                       String
  actionPolicy               String
  confidence                 Float?
  negated                    Boolean
  matchedRuleIds             Json
  routeKey                   String?
  educationalKind            String?
  prohibitedAutonomousAction Boolean
  outcome                    String
  usedLegacyFallback         Boolean
  tookFastPath               Boolean
  metadata                   Json?  // RESERVED — never user text
  @@index([createdAt]) @@index([kind]) @@index([outcome])
  @@index([actionPolicy]) @@index([negated]) @@index([routeKey]) @@index([chatId])
}
```

Migration file: `prisma/migrations/20260625120000_add_agentic_router_decision_trace/`.
Per `docs/DEPLOYMENT.md` prod is state-driven (`prisma db push`), so the table is
applied to prod with `db push` (additive, non-destructive). The versioned migration
+ `migration_lock.toml` (postgresql) keep CI/SQLite and the audit trail consistent.

## What is stored / not stored

**Stored (metadata only):** id, createdAt, chatId?, messageId?, source, kind,
actionPolicy, confidence?, negated, matchedRuleIds (Json `string[]`), routeKey?,
educationalKind?, prohibitedAutonomousAction, outcome, usedLegacyFallback,
tookFastPath. `metadata` (Json?) is **reserved** and MUST never carry user text.

**Never stored:** user message, normalized user message (`normalizedInput`),
assistant answer, system prompt, the decision `reason` string, tool payloads,
secrets, cookies/session. The write path goes through the allowlist in
`decision-summary.ts`, which copies only the fields above — a test asserts the
serialized trace contains neither `normalizedInput` nor `reason`.

## Storage layering (best-effort, never blocks chat)

**Write** (`recordRouterDecisionSafe` → `store.appendRouterDecisionTrace`):
1. mirror into the in-memory buffer (last-resort + test read-back),
2. **durable insert** (`durableAppendTrace` → Prisma), occasional best-effort prune,
3. on durable failure → **Redis append** (v0),
4. all wrapped so it never throws into the response.

**Read** (`getRouterObservabilitySummary({window})` → `store.readTracesWithFallback`):
1. **durable read** (`durableReadTraces`, `createdAt >= cutoff`, newest-first, capped),
2. on failure → Redis (window applied best-effort in memory),
3. then memory. The summary reports `storage`:
   `durable` | `redis_fallback` | `memory_fallback` | `unavailable`.

If the table does not yet exist (pre-`db push` prod window), the durable read/write
throw is caught and the system degrades to the v0 Redis/memory path — chat is never
affected and the UI honestly shows `redis_fallback` / `memory_fallback`.

## Retention

Best-effort: ~1 write in 50 prunes rows older than **90 days** (`DURABLE_RETENTION_DAYS`).
No cron required — reads are always window-bounded (1h / 24h / 7d), so the view stays
bounded even if a prune is missed. The table holds only opaque metadata, so
accumulation is not a privacy risk.

## How to query in admin

`/admin/agentic` (admin-gated; anon `307 → /login`) → **Router Observability**:
- **Window selector** — `?routerWindow=1h|24h|7d` (plain `<Link>`s, no client JS).
- **Status strip** — state, storage-mode badge, source, privacy + retention notes.
- **Stat cards** — total, nav fast-paths, dangerous refusals, educational, negated
  no-nav, normal/unknown LLM.
- **Outcome distribution** — horizontal bars per outcome (count + %), no chart lib.
- **Top matched rules** — ranked rule ids + counts.
- **Recent decisions table** — time, kind, action policy, outcome, negated,
  confidence, route key, matched rules.
- **Safety note** — rendered verbatim.

No write controls, no action buttons, no fake data.

## Behaviour guarantees

- No router / guard / HITL behaviour change — observability only OBSERVES.
- No tool execution, no autonomous business write.
- Recording is fire-and-forget + try/catch — a storage failure never blocks chat.
- Read is admin-only and read-only (server components; no mutation, no LLM).

## Non-goals (unchanged)

No CrewAI / external swarms, no prompt editing, no tool execution UI, no replay,
no live write controls, no changes to any product/vault/outreach/auth model.

## v1.1 — Configurable retention + long-term aggregate (read-only)

Adds, over the EXISTING `AgenticRouterDecisionTrace` table (no new model, no new
migration):

- **Configurable retention.** `OBS_RETENTION_DAYS` (env, optional, bounded `[1,365]`)
  overrides the built-in `DURABLE_RETENTION_DAYS` (90). `getRetentionConfig()` reports
  the effective horizon + whether it came from env. The best-effort prune on write
  (`pruneOldTraces`) now uses this value. No behaviour change when unset.
- **Long-term per-day aggregate.** `durableAggregateByDay({ horizonDays })` reads a
  NARROW projection (`createdAt` + `outcome` only, indexed) within the horizon
  (clamped to retention), then buckets by UTC day in JS — bounded by retention, no
  full-row load, no user text. Gap days are seeded to zero. Returns `ok:false`
  (no throw) when the durable store is unreachable.
- **Summary + UI.** `getRouterObservabilitySummary` now carries an optional
  `longTerm: RouterLongTermSummary` (per-day rows, horizon totals, retention config,
  honest availability). A new read-only `RouterObservabilityLongTerm` component renders
  a per-day stacked-bar history + horizon totals below the windowed trends, with honest
  `unavailable` / `empty` states. Default horizon: `DEFAULT_LONG_TERM_HORIZON_DAYS` (30),
  always clamped to the retention horizon.
- Outcome categorization is shared (`categorizeOutcome` in `stats.ts`) so the day rows,
  the trend bars and the stat cards never disagree.

Read-only only: no new migration, no schema change, no user text, no router/guard/HITL
change, no write controls.

## v1.2 — SQL aggregates for the window views (read-only)

Replaces the v1.1 "load up to 5000 rows, aggregate in memory" path for the
windowed stats / trends / top-rules with **DB-side aggregation** when the durable
store is available. No new table, no migration, no schema change — same
`AgenticRouterDecisionTrace` columns and indexes.

**Where it lives:** `src/lib/agentic/observability/db-aggregates.ts`
(`readDurableRouterDecisionAggregates`).

**How the aggregate is computed (durable + Postgres):**

- **Stats** — two `prisma.groupBy` calls (`by: ["outcome"]` and `by: ["kind"]`,
  `_count: { _all }`) over the window cutoff. Provider-agnostic Prisma query
  builder (no raw SQL); projected into the SAME `RouterDecisionStats` shape, using
  the SAME `categorizeOutcome` mapping, so the stat cards are byte-identical to the
  in-memory path.
- **Trend buckets** — a single parameterized `$queryRaw` (`Prisma.sql`) that bins
  rows by index — `floor((epoch(createdAt) − startEpoch) / bucketSeconds)` — and
  `GROUP BY (idx, outcome)`. The bucket geometry is pinned to the SAME prebuilt
  slots `buildEmptyTrendBuckets` produces (1h = 12×5min, 24h = 24×1h, 7d = 7×1d,
  30d = 30×1d), and the rows are projected into those slots by index — so the bars
  match the in-memory builder exactly. The query is **fully parameterized**
  (start-epoch, bucket-seconds, cutoff/upper timestamps are bound params; the only
  literals are hardcoded column/table identifiers — never user input).
- **Top matched rules** — `matchedRuleIds` is a JSON array column, not groupable in
  portable SQL, so it stays a **bounded in-memory derivation**: read ONLY
  `{ matchedRuleIds }` for the newest `TOP_RULES_SCAN_LIMIT` (2000) rows in the
  window and tally via the shared `getTopMatchedRules`. Honest limitation: at very
  high volume the top-rules reflect the most recent 2000 decisions in the window,
  not the entire window.
- **Recent decisions table** — a SEPARATE, capped read (50, newest-first),
  independent of the aggregate path, so the table stays small while stats/trends
  come from `GROUP BY`.

**Why it's safe:** read-only. The aggregate SELECTs touch only
`createdAt` / `outcome` / `kind` / `matchedRuleIds` — never user text, prompts, or
tool payloads. Every function is best-effort: on ANY failure it returns `ok:false`
and the caller falls back to the v1.1 in-memory path (byte-identical output, just
heavier). Partial SQL results are never mixed with fallback results.

**Provider gate / fallback:** the bucket query uses Postgres epoch arithmetic, so
on any non-Postgres provider (SQLite local/dev/tests) `readDurableRouterDecisionAggregates`
declines (`ok:false`) and the read path uses the in-memory aggregation — correct
everywhere. The chat flow is never touched: this module is admin-read-only and the
chat route does not import it.

**Aggregation mode indicator.** `getRouterObservabilitySummary` now reports
`aggregationMode`:

- `"sql"` — durable DB served the aggregate via `GROUP BY` (O(buckets), no 5000-row load)
- `"in_memory"` — durable rows aggregated in memory (SQL aggregate declined/failed)
- `"fallback"` — aggregated from the Redis/memory buffer (durable store down)

The Router Observability section renders a small read-only badge for this mode
("aggregation: SQL durable aggregates" / "aggregation: fallback in-memory"). No new
controls, no actions.

**Performance.** On Postgres the window stats + buckets are O(buckets) GROUP BY
reads instead of O(rows); only the top-rules scan stays row-bounded (capped 2000).
This removes the artificial 5000-row cap as a scaling ceiling for 30d/90d windows.

Read-only only: no new migration, no schema change, no user text, no router / guard
/ HITL change, no tool execution, no write controls, no CrewAI / external swarms.

## Next lot recommendation

The only remaining row-bounded read is the **top-matched-rules** scan (newest 2000
rows of `matchedRuleIds`, a JSON column). If/when that approximation matters,
either (a) add a normalized `AgenticRouterDecisionRule` join table to make rule
counts a true `GROUP BY` — which WOULD need a migration, so gate it on real
need — or (b) use a Postgres-only JSONB lateral-unnest aggregate behind the same
provider gate (no migration, Postgres-only, fallback to the current scan on
SQLite). Prefer (b) first. Only worth it once a window's matched-rule volume
actually exceeds the 2000-row scan. Still no router/guard change, no CrewAI, no
tool execution, no new table.
