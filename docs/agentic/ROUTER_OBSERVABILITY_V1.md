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

## Next lot recommendation

The 30d window currently reads up to 5000 rows and buckets in memory. If trace
volume grows past that, push the **trend bucketing into SQL** (a single
`date_trunc('day', createdAt)` + `GROUP BY day, outcome` aggregate query) so the
30d view stays O(buckets) instead of O(rows). Only worth it once a 30d window
actually approaches the 5000-row cap. Still no router/guard change, no CrewAI, no
tool execution, no new table.
