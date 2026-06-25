# Router Observability v0

> **Superseded by v1 (durable).** Storage is now a durable Prisma table with
> time-window queries — see [`ROUTER_OBSERVABILITY_V1.md`](./ROUTER_OBSERVABILITY_V1.md).
> This v0 doc describes the original volatile Redis/memory buffer, which remains
> the **fallback** layer when the durable store is unavailable.

Read-only observability of the **Deterministic Intent Router v2**. The router is
active and non-shadow (see [`DETERMINISTIC_INTENT_ROUTER_V2.md`](./DETERMINISTIC_INTENT_ROUTER_V2.md)).
The Agentic Control Center (`/admin/agentic`) already shows what *exists*; this lot
adds what the router *actually did* on recent chat turns.

It is **read-only**: recording is best-effort and changes NO router/guard behaviour;
reading is admin-only. No CrewAI, no tool execution, no writes, no DB migration.

## What it records

One small **metadata** trace per chat turn, into a capped buffer
(`src/lib/agentic/observability/`):

| field | example | source |
| --- | --- | --- |
| `id` | `rdec:turn_…` | derived from the turn id |
| `createdAt` | ISO timestamp | stamped at record time |
| `chatId` / `messageId` | existing cuids | already-persisted ids (NavTrace precedent) |
| `kind` | `navigation`, `yield_explanation` | router decision (enum) |
| `actionPolicy` | `allow_navigation`, `refuse_autonomous` | router decision (enum) |
| `confidence` | `0.95` | router decision |
| `negated` | `true`/`false` | router decision |
| `matchedRuleIds` | `["nav.resolver"]` | router decision (system ids) |
| `routeKey` | `vaults` | whitelisted nav key (enum) |
| `educationalKind` | `yield_explanation` | derived for educational turns |
| `prohibitedAutonomousAction` | `true`/`false` | router decision |
| `outcome` | `nav_fast_path`, `dangerous_refusal`, … | derived at the branch site |
| `usedLegacyFallback` / `tookFastPath` | booleans | derived |
| `source` | `cockpit_chat` | constant (only emitter in v0) |

### Outcomes

- `nav_fast_path` — router high-confidence navigation, published before the LLM.
- `negated_no_nav` — a negation blocked a would-be nav; turn fell through to the LLM.
- `dangerous_refusal` — deploy/send/source/… refused **before** LLM/tool/write.
- `educational_llm` — educational read-only steering applied, then LLM.
- `normal_llm` — ordinary turn → LLM.
- `legacy_fallback_nav` — legacy regex nav fallback published (router missed).
- `unknown` — no deterministic decision (router unavailable / unclassified).

## What it does NOT record (privacy)

**Never stored:** full user message, normalized user message (`normalizedInput`),
full assistant answer, system prompt, the free-form decision `reason` string, tool
payloads, secrets, raw cookies/session, or any personal data beyond the existing
chat/turn ids. The conversion (`decision-summary.ts`) is an **allowlist** — it
copies only the fields above and never reads the user-text fields. A unit test
asserts the serialized trace contains neither `normalizedInput` nor `reason`.

`redact.ts` exists as a conservative truncation/scrub helper for any *future*
optional snippet (≤80 chars, secret/email scrubbing). It is **unused on the hot
path in v0** — no snippet is stored at all.

## Storage (no migration)

A **global capped list** holds the most recent decisions:

- **Redis (Upstash)** when configured — key `agentic:router:decisions`,
  `LPUSH` + `LTRIM` to `ROUTER_DECISIONS_CAP` (200), 7-day TTL. Survives serverless
  cold starts. This is the production path.
- **In-memory `globalThis` buffer** as a fallback (dev / single instance), mirrored
  on every write so a single runtime and the tests can read back. Lost on cold
  start — surfaced honestly as `storage: memory`.

No Prisma model, no schema change, no migration. A single **global** key is safe
because **no user text is stored** — the admin cross-turn view needs no userId.

## Behaviour guarantees

- **No router change**: the recorder only observes the already-computed decision +
  the outcome the route derived at each branch. No condition was modified.
- **No guard change**: the compliance guard is untouched.
- **No HITL / no tool / no write**: the dangerous-refusal path still returns before
  the LLM with no confirmation token; recording adds none.
- **Non-blocking**: every call is `void recordRouterDecisionSafe(...)`
  (fire-and-forget) with an internal try/catch. A trace failure logs at warn and
  is swallowed — the chat response is never affected (route-level test pins this).
- **Exactly once per turn**: each turn records a single trace at its decision site.

## Admin view

`/admin/agentic` → **Router Observability** section (admin-gated; anon `307 → /login`):

- **Status strip** — state (`enabled` / `empty` / `unavailable`), storage mode
  (`redis` / `memory`), source, privacy mode.
- **Stat cards** — recent total, navigation fast-paths, dangerous refusals,
  educational turns, negated · no-nav, normal/unknown LLM.
- **Recent decisions table** — time, kind, action policy, outcome, negated,
  confidence, matched rules, route key, source.
- **Safety note** — rendered verbatim: *"Read-only router metadata. No prompts, no
  message text, no secrets, no tool payloads, no autonomous writes."*

Empty state when no trace yet; unavailable state if no safe store is found. No write
controls, no action buttons, no fake data.

## How to interpret traces

- A spike in `dangerous_refusal` means users are asking the chat to deploy/send/
  source — all correctly refused before the LLM.
- `negated_no_nav` shows the negation guard working ("ne montre pas les vaults").
- `legacy_fallback_nav` vs `nav_fast_path` shows how often the router itself drives
  navigation vs the legacy regex safety net.
- `unknown` indicates the router returned no decision (rare) — the turn still ran.

## Limits of v0

- Global capped buffer (200) + TTL — not a long-term analytics store.
- In-memory fallback is per-instance and lost on cold start (honest `memory` mode).
- One emitter (`cockpit_chat`); no per-user drill-down, no charts, no export.

## v0.1 — Trends (read-only, same buffer)

Added time-window **trend visualizations** in the same `/admin/agentic` Router
Observability section, derived from the SAME capped buffer — **no new storage, no
new recorded fields, no migration**.

- **Module:** `src/lib/agentic/observability/trends.ts` (pure functions).
- **Windows:** `1h` (12 × 5 min), `24h` (24 × 1 h), `7d` (7 × 1 day). Selected via the
  optional `?routerWindow=1h|24h|7d` query param (plain `<Link>` navigation — no form,
  no write). Invalid/missing → defaults to `24h`.
- **Bucket categorization mirrors `stats.ts` exactly** so the stat cards and the trend
  bars never disagree: `nav_fast_path`→navigationFastPaths, `dangerous_refusal`→
  dangerousRefusals, `educational_llm`→educationalTurns, `negated_no_nav`→negatedNoNav;
  `normal_llm` / `unknown` / `legacy_fallback_nav` / anything else → normalOrUnknown.
- **Views:** stacked outcome-trend bars over time, an outcome distribution (horizontal
  bars), and a top-matched-rules frequency list. All dependency-free, DS tokens only
  (no hardcoded hex). Honest empty states when a window has no decisions.
- **Buffer note** rendered verbatim: *"Trends are computed from the capped v0 router
  trace buffer: max 200 traces, TTL 7 days."*
- **Robustness:** traces with invalid/missing timestamps or outside the window are
  ignored cleanly; never throws. Recording flow + storage are unchanged.

### How to read the trends

- A rising `dangerous_refusal` share over time = more deploy/send/source attempts,
  all correctly refused before the LLM.
- A high `normalOrUnknown` share with low `nav_fast_path` = most turns are plain LLM.
- Top matched rules surface which router rules fire most (e.g. `deploy.go_live`).

## Next lot recommendation

Promote the capped buffer to a **durable, queryable trace** (a dedicated Prisma
model behind an explicit migration) with longer retention and per-user drill-down —
only once durable retention is actually needed (tracked separately as the durable
observability lot). Still no router/guard change, no CrewAI, no tool execution.
