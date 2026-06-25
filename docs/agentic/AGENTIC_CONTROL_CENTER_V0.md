# Agentic Control Center — v0.1 (read-only visibility)

**Route:** `/admin/agentic` · **Status:** read-only static registry · **Owner module:** `src/lib/agentic/control-center/`

## Why this exists

The agentic chain — agents, prompts, tools, guards, human gates, router — already
lives in code, but it was invisible from the product. There was no single place
where an admin could answer:

- which agents / logics exist;
- where their prompts live;
- which tools they can call (read / draft / confirmed-write / forbidden);
- which actions can **never** be autonomous;
- what is active vs shadow;
- what guards protect the system;
- what the real router state is.

The Agentic Control Center makes that chain **visible**, in one read-only page.
It is a **control / visibility surface, not an orchestration runtime**: it shows
the system; it never executes it.

## What it shows

The page (`src/app/admin/agentic/page.tsx`) renders nine sections, all fed by one
aggregator over static, typed modules:

| Section | Module | Accessor |
| --- | --- | --- |
| 1. System status | (page) | composed |
| 2. Router | `router-status.ts` | `getRouterStatusSummary()` |
| 3. Agents & logic inventory | `inventory.ts` | `getAgenticInventory()` |
| 4. Tool boundary | `tool-boundary-summary.ts` | `getToolBoundarySummary()` |
| 5. Human gates | `gates.ts` | `getHumanGateInventory()` |
| 6. Prompt map | `prompt-map.ts` | `getPromptMap()` |
| 7. Compliance / Guards | (page + router policy) | composed |
| 8. Safety summary | `safety-summary.ts` | `getSafetySummary()` |
| 9. Next architecture steps | `next-steps.ts` | `getNextSteps()` |

`index.ts` exposes `getAgenticControlCenterData()` which composes all of the
above into one `AgenticControlCenterData` object (the page calls only this).

## Read-only guarantee

This feature is **read-only by construction**:

- No DB query, no Prisma call.
- No LLM call.
- No tool execution, no confirmation token creation, no write.
- No filesystem scan at runtime — the inventory is a static, client-safe constant.
- `generatedAt` is the literal string `"static registry v0.1 / read-only"`, **not**
  a live timestamp (pure code: no `Date.now()`).
- The page is `export const dynamic = "force-static"`.

It describes the agentic chain; it never drives it.

## What it shows about the router (real state, post PR #36)

- **Active, non-shadow** — `AGENTIC_ROUTER_SHADOW` is removed (no refs).
- Active paths (before the LLM): navigation fast-path, negation protection,
  dangerous-intent refusal, educational read-only steering.
- Shadow / not built: full crew runtime, external swarms / CrewAI, tool-execution
  orchestration.
- Legacy nav fallback retained, gated on `!decision.negated`.
- Guard policy: output guard is **not** bypassed — forbidden words + single-point
  APY headline stay hard-blocked; educational steering is prompt-only.

## How inventory is maintained

1. Open `src/lib/agentic/control-center/inventory.ts`.
2. Append an `AgenticInventoryItem` with accurate `paths` + `promptLocations` and
   flags (`type`, `status`, `writesAllowed`, `humanGateRequired`, `riskLevel`).
3. `writesAllowed` means "the underlying logic touches a persisted row" — it does
   **not** mean the chat can trigger it autonomously. `humanGateRequired` + the
   Human Gates section are the authoritative "never autonomous" record.
4. The inventory test asserts core items are present + ids unique — keep it green.

## How gates are represented

- `src/lib/agentic/control-center/gates.ts` lists every critical action.
- **Every** gate is `autonomousAllowed: false`, `requiresHuman: true`,
  `requiresAdmin: true`, `requiresConfirmation: true` — the test enforces this
  invariant. deploy / safe_signature / governance_execute / db_migration /
  formula_change / model_change are `riskLevel: "critical"`.
- `protectedActions` names the concrete tool ids / server actions behind the gate.

## How prompts are mapped

- `prompt-map.ts` surfaces **paths + summaries only**, never full prompt bodies, to
  avoid exposing the steering surface in the UI.
- Every entry carries `editableInUi: false` — prompts are not editable from here.

## Router Observability (live, read-only) — durable in v1

The page also renders a **Router Observability** section: live, read-only metadata
about what the deterministic router actually did on recent chat turns. In **v1** this
is **durable** — a dedicated Prisma table (`AgenticRouterDecisionTrace`) with
time-window queries (1h / 24h / 7d), an outcome distribution, top matched rules, and
a recent-decisions table; with a Redis → memory **fallback** when the durable store
is unavailable. It records NO user text, NO prompts, NO secrets, NO tool payloads,
and performs NO write. Full contract:
[`ROUTER_OBSERVABILITY_V1.md`](./ROUTER_OBSERVABILITY_V1.md) (v0 buffer:
[`ROUTER_OBSERVABILITY_V0.md`](./ROUTER_OBSERVABILITY_V0.md)). The page is
dynamically rendered so the section can read live data; the registry sections stay pure.

**v0.1 trends:** the section also shows read-only **trends** over a selectable window
(`?routerWindow=1h|24h|7d`) — stacked outcome bars over time, an outcome distribution,
and top matched rules — all computed from the SAME capped buffer (no new storage, no
migration). DS tokens only, honest empty states. See the v0.1 section of
[`ROUTER_OBSERVABILITY_V0.md`](./ROUTER_OBSERVABILITY_V0.md).

## What it does NOT do (non-goals)

- No crew runtime. No CrewAI / external swarms connected.
- No tool execution, no write, no confirmation token.
- No run counters on the static registry (status reflects code wiring, not activity).
- No prompt editing. No deploy console.
- No chat-route / router / guard / HITL / tool-registry runtime changes (the
  observability hook only OBSERVES — it never changes a router/guard condition).
- The ONLY schema change is the additive, read-only `AgenticRouterDecisionTrace`
  table (router observability v1). No business model is touched.

## Limits of v0.1

- Registry sections are static, not live: a future lot can wire `LlmRun` +
  `AdminToolRun` counts in.
- Manual registry: adding an agent in code does not auto-register it here.
- Router Observability v1 durable rows are pruned best-effort > 90 days; reads are
  window-bounded. When the durable store is unavailable it falls back to the volatile
  Redis/memory buffer (shown honestly as `storage: redis_fallback` / `memory_fallback`).
- Router Observability **v1.2** computes the windowed stats / trends / top-rules via
  SQL `GROUP BY` aggregates (`db-aggregates.ts`) on Postgres instead of loading up to
  5000 rows — surfaced read-only as an `aggregation: SQL durable aggregates` badge.
  It declines to the in-memory path on SQLite or any failure (badge
  `aggregation: fallback in-memory`). No new table, no migration, no schema change.
  See the v1.2 section of [`ROUTER_OBSERVABILITY_V1.md`](./ROUTER_OBSERVABILITY_V1.md).
- **Router Quality Review v0** interprets the observability data (read-only): health
  rates (unknown / dangerous-refusal / educational / nav / fallback), a negated-no-nav
  count, top matched rules, and a watchlist of degraded patterns (high unknown / high
  dangerous-refusal / high-fallback / no-recent-data). Pure derivation from the summary
  (`quality-review.ts`), no query, no rule/prompt/guard/HITL change, no action.
  See [`ROUTER_QUALITY_REVIEW_V0.md`](./ROUTER_QUALITY_REVIEW_V0.md).
- **Tool Boundary v1** reflects the REAL tool registry (read-only): the 11 read +
  7 write tool ids are reflected from the side-effect-free id arrays
  (`src/lib/agentic/tool-boundary`), classified into tiers
  (read_only / draft_or_proposal / confirmed_write / forbidden_autonomous / unknown)
  with per-tool gate / risk / runtime / source, plus static-vs-code consistency
  warnings and a completeness test that fails if any real tool id is unclassified.
  Attached as `AgenticControlCenterData.toolBoundaryV1` (additive; the legacy static
  `tools` tier list is unchanged). No tool execution, no registry change, no write UI.
  See [`TOOL_BOUNDARY_V1.md`](./TOOL_BOUNDARY_V1.md).
- **Reporting Crew Read-Only v0** is the first applicative "crew": a deterministic,
  read-only briefing (`src/lib/agentic/reporting`) that composes the control-center
  registry + observability + quality review + tool boundary + gates + safety into an
  executive summary, section metrics/signals, a watchlist, and recommended read-only
  checks. NOT CrewAI and NOT an autonomous runtime — no tool execution, no write, no
  loop, no stored user text/prompt/payload. Rendered after the Observability section
  via `getReportingCrewBriefing()` (reuses the page's observability read).
  See [`REPORTING_CREW_READONLY_V0.md`](./REPORTING_CREW_READONLY_V0.md).

## Next steps

See the in-page "Next architecture steps" (and `next-steps.ts`): durable/queryable
router traces · Chat Engine / Context Composer extraction · Tool Boundary split ·
Reporting Crew (read-only) · Product Workspace Crew · Investor Pipeline Crew. All are
`planned`, none built.
