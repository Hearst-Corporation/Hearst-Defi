# Router Observability v1 — durable

v1 promotes [Router Observability v0](./ROUTER_OBSERVABILITY_V0.md) from a volatile
capped Redis buffer to a **durable, queryable** store with time-window filters,
surfaced read-only in `/admin/agentic`. It changes NO router/guard/HITL behaviour
and stores NO user text. One targeted Prisma table is added; no other model changes.

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

## Next lot recommendation

If a longer analytics horizon is genuinely needed, push the per-day aggregate INTO SQL
(`groupBy` on a date-truncated `createdAt`) so the read never loads rows, and add an
admin CSV export of the windowed metadata. Still no router/guard change, no CrewAI, no
tool execution.
