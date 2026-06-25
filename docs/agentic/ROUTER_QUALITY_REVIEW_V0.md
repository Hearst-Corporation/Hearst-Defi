# Router Quality Review v0 (read-only)

A read-only **interpretation** layer over the existing Router Observability data.
It turns the window stats (+ top rules + storage/aggregation mode) into health
**rates** and a **watchlist** of degraded patterns, so an admin can SEE problems
in `/admin/agentic` without changing any router/guard/HITL behaviour.

**This is visibility only.** It issues no query, stores nothing, and produces no
action — every output is a label, a rate, or a flag.

## Where it lives

- **Computation (pure):** `src/lib/agentic/observability/quality-review.ts`
  (`computeRouterQualityReview`)
- **Types:** `src/lib/agentic/observability/types.ts`
  (`RouterQualityReview`, `RouterQualityRate`, `RouterQualitySignal`)
- **Wiring:** `read-router-decisions.ts` attaches `summary.qualityReview` (additive,
  optional) after building the summary — no new fetch.
- **UI:** `src/components/admin/agentic/router-quality-review.tsx`, rendered by
  `router-observability-section.tsx` right after the trends.

## What it shows

**Health rates** (count / total over the selected window — `?routerWindow=1h|24h|7d|30d`):

- Unknown rate — how often the router produced no deterministic decision
- Dangerous-refusal rate — deploy/send/source/… intents refused before LLM/tool/write
- Educational rate — read-only educational steering applied
- Navigation fast-path rate — high-confidence nav published before the LLM
- Legacy-fallback rate — the legacy regex nav fallback had to publish

Plus a raw **negated-no-nav** count and the **top matched rules** (echoed read-only).

**Watchlist** — every signal is always listed (active or `ok`):

| Signal | Active when | Severity |
| --- | --- | --- |
| High unknown rate | unknown rate ≥ `UNKNOWN_RATE_WATCH` (0.20) and sample ≥ `MIN_SAMPLE_FOR_RATES` (20) | watch |
| High dangerous-refusal rate | dangerous-refusal rate ≥ `DANGEROUS_REFUSAL_RATE_WATCH` (0.15) and enough sample | alert |
| High fallback / degraded source | storage is a Redis/memory fallback OR `aggregationMode` = fallback, OR legacy-fallback rate ≥ `FALLBACK_RATE_WATCH` (0.10) | watch |
| No recent data | total is 0, or the most recent trend buckets are all empty | info |

Thresholds are explicit, conservative constants exported from `quality-review.ts`.
A signal is a **prompt for a human to look**, never an automated action. The
`MIN_SAMPLE_FOR_RATES` floor avoids alerting on tiny windows (e.g. 1/2 = 50%).

## How it reads the data

`computeRouterQualityReview(summary)` is pure — same input, same output, no I/O. It
reads only `summary.stats` (named counts + total), `summary.topMatchedRules`,
`summary.trendBuckets` (for "no recent data"), and `summary.storage` /
`summary.aggregationMode` (degraded-source signal). Categorization mirrors
`stats.ts` so the rates never disagree with the stat cards. It never mutates the
input summary.

## Safety / non-goals

- **No router behaviour change. No guard behaviour change. No HITL change.**
- No rule editor, no prompt editor, no auto-fix, no replay, no export.
- No tool execution, no autonomous writes, no CrewAI / external swarms.
- No new query, no DB migration, no Prisma/schema change, no new table.
- No user text / prompt / tool payload — the review operates on counts and rates only.

## Next lot recommendation

`Tool Boundary split` (roadmap #9): make the static tool-boundary registry in the
Control Center reflect the REAL read/write/forbidden tool tiers from
`src/lib/llm/tools/*`, still read-only, no execution. Only after the observability
+ quality surfaces are stable. Do NOT wire any Crew runtime / CrewAI / tool
execution yet.
