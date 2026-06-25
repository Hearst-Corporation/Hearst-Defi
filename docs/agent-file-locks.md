# Agent File Locks

This file tracks active file ownership for multi-agent work.

Agents must reserve files here before editing.

## Rules

- If a path is locked by another active agent, do not edit it.
- If a task needs a locked path, stop and ask for arbitration.
- Release or move the lock to `RELEASED LOCKS` after merge.
- Do not remove another agent’s lock without explicit user approval.
- Sensitive files require explicit ownership.

---

## ACTIVE LOCKS

_No active locks._

---

## RELEASED LOCKS

### feat/crew-simulation-readonly-v0
Owner: Agent C — Crew Simulation Read-Only
Branch: feat/crew-simulation-readonly-v0
Merged PR: #69 (merge d6aa5b1e)
Released: 2026-06-25
Status: merged

Result:
- Crew Simulation Read-Only v0: pure static module src/lib/agentic/crew-simulation/*
  (types, scenarios, simulate-crew-flow, safety, index) — deterministic read-only
  representation of 6 crew flows (reporting_crew_briefing / outreach_draft_flow /
  product_review_flow / risk_explanation_flow / vault_readiness_flow / memory_distill_flow).
  Every scenario and step carries executable:false as a TypeScript structural invariant.
  simulateCrewFlow(id) returns a full CrewSimulationResult with blockedActions +
  requiredGates, or a typed CrewSimulationError for unknown ids — no fallback execution.
  Safety module asserts zero violations across all built-in scenarios. Outreach send
  hard-blocked (HITL gate + Tier A never auto-send); mainnet deploy hard-blocked (ADR-006).
  NO UI integration, NO CrewAI, NO autonomous runtime, NO tool execution, NO write tools,
  NO router/guard/HITL/chat change, NO Prisma/schema change, NO migration. 46/46 tests
  passing, typecheck PASS, build PASS (postgresql), empty Prisma diff. Vercel PENDING at
  merge time. Next integration point: visual flow console in /admin/agentic (out of scope v0).

### feat/agentic-visual-console
Owner: Opus Orchestrateur Continu — Agentic Visual Control Center Implementation
Branch: feat/agentic-visual-console
Merged PR: #65 (merge 6c24b3c5)
Released: 2026-06-25
Status: merged

Result:
- Agentic Visual Control Center v0: /admin/agentic is now a visual console — Layer 1 is a
  live read-only system map (new pure module src/lib/agentic/system-map: types,
  build-system-map, derive-system-map-status, index) rendering layered clusters of connected
  nodes (router / guards / HITL gates / tool boundary / crews / agents / observability / tool
  tiers) with live status/mode/risk badges, metrics, and wiring edges (routes/reads/guards/
  gates/observes/composes/forbids); Layer 2 is a detail inspector + the existing panels
  reorganized below (each given an anchor id the map/inspector link to). New components
  agentic-system-map.tsx + agentic-detail-inspector.tsx; token-only premium CSS in
  admin-docs.css (no hardcoded hex). Nav consolidated: "Agentic Console" (/admin/agentic,
  Workflow icon) vs "Agent Library" (/admin/agents, Bot icon) — both routes kept (distinct
  functions). NOT CrewAI, NO autonomous runtime, NO tool execution, NO write tools, NO
  router/guard/HITL/chat change, NO Prisma/schema change, NO migration, NO user text/prompt/
  tool payload. typecheck PASS, lint 0, full suite 3367/3367, build PASS (postgresql), empty
  Prisma diff. Merged 6c24b3c5, PR #65 (committed + merged by the auto-managed worktree
  pipeline). Worktree torn down post-merge.

### feat/action-readiness-matrix-v0
Owner: Agent B — Action Readiness Matrix
Branch: feat/action-readiness-matrix-v0
Merged PR: #66 (merge 7980690f)
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agentic/action-readiness/**
- docs/agentic/ACTION_READINESS_MATRIX_V0.md
- src/lib/agentic/action-readiness/__tests__/**
- docs/agent-file-locks.md

Result:
- Action Readiness Matrix v0: pure read-only module classifying 21 platform actions
  across 4 tiers (read_only / draft_or_proposal / confirmed_write / forbidden_autonomous).
  7 read-only (autonomous), 5 draft/proposal (HITL-gated), 1 confirmed-write
  (outreach_trigger_send_run, multi-gate), 8 forbidden-autonomous (deploy/markAsLive/
  Safe sig/governance exec/DB migration/formula change/lead sourcing/Tier A auto-send).
  classifyUnknownAction() fail-safe: write-like unknowns → forbidden_autonomous.
  validateItem() consistency guard at build time. 35 tests, 8 safety notes.
  docs/agentic/ACTION_READINESS_MATRIX_V0.md. NO I/O, NO DB, NO tool execution,
  NO UI change, NO Prisma/schema diff, NO migration, NO router/guard/HITL/chat change.
  35/35 tests PASS, zero typecheck errors in module, gitleaks clean.
  Merged 7980690f, PR #66.

### feat/reporting-crew-readonly-v0
Owner: Opus Orchestrateur Continu — Reporting Crew Read-Only v0 Implementation
Branch: feat/reporting-crew-readonly-v0
Merged PR: #63 (merge 0f357584)
Released: 2026-06-25
Status: merged

Result:
- Reporting Crew Read-Only v0: the first applicative "crew" — a deterministic, read-only
  briefing in /admin/agentic composed from existing data (control-center registry +
  observability summary + quality review + tool boundary + gates + safety). Module
  src/lib/agentic/reporting/* : pure composeReportingCrewBriefing(inputs) → executive
  summary, router health, tool boundary health, safety & gates, observability signals,
  watchlist, recommended read-only checks; status derived alert>watch>no_data>healthy.
  collect-inputs (server-only, best-effort) reuses the page's observability read.
  New ReportingCrewSection UI after the Observability section, NO write controls; a test
  asserts no recommendation contains a forbidden write verb (send/source/deploy/mark-live/
  execute/approve/mutate). NOT CrewAI, NOT an autonomous runtime/loop. NO tool execution,
  NO write tools, NO router/guard/HITL/chat change, NO registry runtime change, NO Prisma/
  schema change, NO migration, NO user text/prompt/tool payload. Integrated at page level so
  getAgenticControlCenterData stays pure (all existing control-center tests unchanged).
  typecheck PASS, lint 0, full suite 3317/3317, build PASS (postgresql), empty Prisma diff.
  Merged 0f357584, PR #63. Vercel prod READY; prod /admin/agentic 307→/login.

### feat/tool-boundary-v1
Owner: Opus Orchestrateur Continu — Tool Boundary v1 Delivery
Branch: feat/tool-boundary-v1
Merged PR: #61 (merge c1ac9beb)
Released: 2026-06-25
Status: merged

Result:
- Tool Boundary v1: read-only reflection of the REAL tool registry in /admin/agentic.
  New pure module src/lib/agentic/tool-boundary/* reflects the 11 read + 7 write tool
  ids from the side-effect-free ADMIN_READ_TOOL_IDS / ADMIN_WRITE_TOOL_IDS arrays (NOT
  the server-only registry.ts), joined with a curated metadata map whose completeness is
  asserted by tests (fail if any real id is unclassified). classify-tool.ts → tiers
  read_only / draft_or_proposal / confirmed_write / forbidden_autonomous / unknown
  (writes always gated + non-autonomous; unclassified fails safe high-risk). consistency.ts
  → write-without-gate (critical), confirmed-write-autonomous (critical), unknown tool
  (warning), static-vs-code drift (warning). Wired as AgenticControlCenterData.toolBoundaryV1
  (additive; legacy static `tools` unchanged) + new ToolBoundarySection UI (counts, table,
  warnings, forbidden actions, safety notes, NO write controls). NO tool execution, NO
  registry/runtime change, NO tool added/removed/changed, NO router/guard/HITL/chat change,
  NO Prisma/schema change, NO migration, NO user text/prompt/tool payload. typecheck PASS,
  lint 0, full suite 3292/3292, build PASS (postgresql), empty Prisma diff. Merged c1ac9beb,
  PR #61. Vercel prod READY; prod /admin/agentic 307→/login.

### feat/router-quality-review-v0
Owner: Opus Orchestrateur Continu — Router Quality Review Dashboard Delivery
Branch: feat/router-quality-review-v0
Merged PR: #59 (merge b8efe89a)
Released: 2026-06-25
Status: merged

Result:
- Router Quality Review Dashboard v0: read-only INTERPRETATION of the existing router
  observability data in /admin/agentic. Pure computeRouterQualityReview(summary)
  (quality-review.ts) → health rates (unknown / dangerous-refusal / educational / nav /
  legacy-fallback), a negated-no-nav count, top matched rules, and a read-only watchlist
  (high_unknown / high_dangerous_refusal[alert] / high_fallback[degraded source or high
  legacy rate] / no_recent_data) with explicit conservative thresholds + a
  MIN_SAMPLE_FOR_RATES floor. Attached as optional summary.qualityReview (additive,
  backward-compatible); new RouterQualityReview component after the trends, rate cards +
  watchlist, NO actions. NO router/guard/HITL change, NO rule/prompt editor, NO auto-fix /
  replay / export, NO tool execution / autonomous writes / CrewAI, NO Prisma/schema change,
  NO migration, NO new table, NO user text/prompt/tool payload. typecheck PASS, lint 0,
  full suite 3261/3261, build PASS (postgresql), empty Prisma diff. Merged b8efe89a, PR #59.
  Vercel prod READY; prod /admin/agentic?routerWindow=1h|24h|7d|30d all 307→/login.

### feat/router-observability-sql-aggregates-v12
Owner: Opus Orchestrateur — SQL Router Observability Aggregates Delivery
Branch: feat/router-observability-sql-aggregates-v12
Merged PR: #55
Released: 2026-06-25
Status: merged

Result:
- SQL Router Observability Aggregates v1.2: durable window stats/trends/top-rules
  computed DB-side (O(buckets), not O(rows)) — stats via prisma.groupBy(outcome+kind),
  trend buckets via a Postgres-only parameterized $queryRaw projected into the SAME
  bucket slots (byte-identical to in-memory; parity test asserts toEqual for all 4
  windows), top rules in-memory from a bounded matchedRuleIds read. Recent table is a
  separate take:50; the 5000-row aggregate read is eliminated on the durable path.
  Fallback: SQL declined/failed (sqlite/local) → in_memory; DB down → fallback.
  Read-only "aggregation: SQL durable aggregates | fallback in-memory" badge. NO
  schema change, NO migration, NO new table; no router/guard/HITL change; reads only
  createdAt/outcome/kind/matchedRuleIds (no user text). typecheck PASS, lint 0, full
  suite 3235/3235, build PASS, empty Prisma diff. Merged 4c916a38, PR #55.

### feat/router-observability-long-window-v11
Owner: Opus Orchestrateur — Long-Window Router Observability Delivery
Branch: feat/router-observability-long-window-v11
Merged PR: #52
Released: 2026-06-25
Status: merged

Result:
- Long-Window Router Observability v1.1: added a 30d window (30 daily buckets) to
  the selector + trends + durable read (1h/24h/7d intact); recent table sliced to
  50 from a single createdAt-indexed windowed read (aggregate cap 5000); fallback
  surfaces a windowLimitationNote for 30d. Added a dry-run-default pruning helper
  (pruneRouterDecisionTraces) on top of PR #51's retention config (OBS_RETENTION_DAYS,
  default 90) + a read-only retention-policy note in /admin/agentic. NO Prisma/
  schema change, no new table, no migration; no router/guard/HITL change; no user
  text stored. Reconciled by merge with the concurrent retention/long-term lot
  (PR #51) — durable feeds both the 30d window and the per-day long-term aggregate.
  typecheck PASS, lint 0, full suite 3216/3216, build PASS. Merged 1cf26a39, PR #52.

### feat/router-observability-retention-v1
Owner: Opus Orchestrateur — Router Observability Retention Delivery
Branch: feat/router-observability-retention-v1
Merged PR: #51
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agentic/observability/** (retention config + durableAggregateByDay + long-term summary)
- src/lib/env.ts (OBS_RETENTION_DAYS, optional additive)
- src/components/admin/agentic/router-observability-longterm.tsx (new) + section render
- docs/agentic/ROUTER_OBSERVABILITY_V1.md (v1.1) + tests

Result:
- Read-only configurable retention (OBS_RETENTION_DAYS, default 90, [1,365]) + long-term
  per-day aggregate over the EXISTING AgenticRouterDecisionTrace table. NO new model, NO
  migration, NO schema change. durableAggregateByDay reads a narrow createdAt+outcome
  projection (indexed), buckets by UTC day, clamped to retention, ok:false on DB failure.
  New RouterObservabilityLongTerm component (per-day bars + horizon totals, honest
  unavailable/empty). categorizeOutcome shared from stats.ts. No router/guard/HITL change,
  no user text stored. typecheck PASS, lint 0, full suite 3198/3198, build PASS, Vercel
  prod READY (deploy 5193211024). Merged adc25a06, PR #51. Only red check = pre-existing
  Playwright login-flow:91 (out of scope).

### feat/router-observability-durable-v1
Owner: Opus Orchestrateur — Durable Router Observability v1 Delivery
Branch: feat/router-observability-durable-v1
Merged PR: #47
Released: 2026-06-25
Status: merged

Result:
- Durable Router Observability v1: new additive Prisma table AgenticRouterDecisionTrace
  (+ indexes, migration) — applied to prod via db push (5432). Durable store (db-store.ts)
  DB-first -> Redis -> memory fallback, time-window queries, top rules, best-effort prune
  > 90 days; never throws into chat. /admin/agentic v1: window selector (1h/24h/7d),
  storage-mode badge, outcome distribution, top matched rules, recent table. Reconciled
  by merge with the concurrent trends lot (PR #46) — durable now feeds the trends.
  No router/guard/HITL behavior change, no user text stored. typecheck PASS, lint 0,
  full suite 3182/3182, build PASS. Merged 9eb5d439, PR #47.

### feat/router-observability-trends-v01
Owner: Opus Orchestrateur — Router Observability Trends Delivery
Branch: feat/router-observability-trends-v01
Merged PR: #46
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agentic/observability/trends.ts (new) + types.ts/read-router-decisions.ts/index.ts (additive)
- src/components/admin/agentic/router-observability-trends.tsx (new) + section.tsx (additive)
- src/app/admin/agentic/page.tsx (searchParams.routerWindow)
- docs/agentic/ROUTER_OBSERVABILITY_V0.md + AGENTIC_CONTROL_CENTER_V0.md + tests

Result:
- Read-only Router Observability TRENDS v0.1 in /admin/agentic: time-bucketed outcome
  trends (1h/24h/7d via ?routerWindow=), outcome distribution, top matched rules, buffer
  note — all computed from the EXISTING capped v0 buffer (NO new storage, NO migration,
  NO Prisma, NO recorded fields added). Categorization mirrors stats.ts. Dependency-free
  DS-token bars, honest empty states, window selector = plain <Link> (no form/write).
  Additive-only so it coexists with the parallel durable-observability lot. No router/
  guard/HITL behavior change. typecheck PASS, lint 0, full suite 3171/3171, build PASS,
  Vercel prod READY. Merged 9f0dd9de, PR #46. Prod /admin/agentic + ?routerWindow=
  variants all 307→/login (correct gate). Foundry CI red = transient foundryup toolchain
  download (infra, not code); Playwright login-flow:91 pre-existing.

### feat/router-observability-traces-v0
Owner: Opus Orchestrateur — Router Observability Traces Delivery
Branch: feat/router-observability-traces-v0
Merged PR: #44
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agentic/observability/** (new module)
- src/lib/trace-ids.ts (+buildRouterDecisionId)
- src/app/api/cockpit-chat/route.ts (trace emission only — NO behavior change)
- src/app/admin/agentic/page.tsx + src/components/admin/agentic/router-observability-section.tsx
- docs/agentic/ROUTER_OBSERVABILITY_V0.md + AGENTIC_CONTROL_CENTER_V0.md

Result:
- Read-only Router Observability v0: per-turn SAFE metadata trace (no user text —
  drops normalizedInput + reason) recorded best-effort into a capped global Redis
  list (`agentic:router:decisions`) with in-memory fallback; NO Prisma model, NO
  migration. Route hook is fire-and-forget per branch (nav_fast_path /
  dangerous_refusal / legacy_fallback_nav / educational_llm / negated_no_nav /
  normal_llm / unknown) — never blocks the response, never changes a router/guard
  condition. /admin/agentic gains a Router Observability section (status / stats /
  recent table / safety note / honest empty+unavailable), page made dynamic. +35
  tests. typecheck PASS, lint 0, full suite 3144/3144, build PASS. Merged c9663274,
  PR #44.

### feat/agentic-control-center-v01
Owner: Opus Orchestrateur — Agentic Control Center Delivery
Branch: feat/agentic-control-center-v01
Merged PR: #41
Released: 2026-06-25
Status: merged

Scope:
- src/app/admin/agentic/page.tsx
- src/components/admin/agentic/status-badge.tsx
- src/lib/agentic/control-center/** (types, inventory, gates, tool-boundary-summary,
  prompt-map, router-status, safety-summary, next-steps, index, tests)
- docs/agentic/AGENTIC_CONTROL_CENTER_V0.md

Result:
- Agentic Control Center v0 -> v0.1: added next-steps.ts + getAgenticControlCenterData()
  aggregator; widened types (server-action/registry/prompt/observability, planned,
  none/critical); inventory expanded to 22 verified items; tool boundary uses the real
  11 read + 6 write tool ids; gates add governance_execute/formula_change/model_change
  (critical); page gained a System Status banner + dedicated Compliance/Guards section +
  data-driven Next Steps. Rebased onto PR #40 (router-final) — merged its
  RouterStatusSummary additions (status/mode/shadowFlag/guardAssertions/statusBlock/
  release) rather than clobbering. Read-only only; no chat/router/guard/HITL/tool/Prisma
  change. typecheck PASS, lint 0, full suite 3109/3109, build PASS, Vercel prod READY.
  Merged 67ca8967, PR #41. Only red check = pre-existing Playwright login-flow:91 (out of
  scope, non-blocking).

### feat/agentic-control-center-router-final
Owner: Opus Orchestrateur — Agentic Control Center v0 (router-final)
Branch: feat/agentic-control-center-router-final
Merged PR: #40
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agentic/control-center/router-status.ts + types.ts + safety-summary.ts
- src/lib/agentic/control-center/__tests__/control-center.test.ts
- src/app/admin/agentic/page.tsx

Result:
- /admin/agentic now surfaces the CLOSED Router Stabilization final state
  (read-only): status active / non-shadow, AGENTIC_ROUTER_SHADOW dead, verbatim
  Router Status block, guard-handoff assertions (guard never relaxed — no intent
  param; forbidden/guaranteed/single-point APY still blocked; no HITL token on
  refusal), release metadata (merge bcb55f2c #36 / lock 49ce60cc #37 / Vercel
  READY / 3055-test suite). +8 tests (control-center 40). No router/guard/route/
  HITL/tool/Prisma change. typecheck PASS, lint 0, full suite 3095/3095, build
  PASS. Merged a4b53754, PR #40.

### feat/agentic-control-center-v0
Owner: Agentic Control Center Owner
Branch: feat/agentic-control-center-v0
Merged PR: #38
Released: 2026-06-25
Status: merged

Scope:
- src/app/admin/agentic/** + page.tsx
- src/components/admin/agentic/**
- src/lib/agentic/control-center/**
- docs/agentic/AGENTIC_CONTROL_CENTER_V0.md
- src/components/nav/product-nav-items.ts (additive "Agentic" sub-nav tab) + nav/route snapshot tests
- Base repair (out-of-band, user-authorized): admin/audit/page.tsx, admin/signals/actions.ts,
  admin/customers/actions.ts, admin/proofs/actions.ts, lib/admin/audit.ts,
  inngest outreach-auto-send.ts + outreach-followups.ts

Result:
- Read-only Agentic Control Center v0 shipped at /admin/agentic: static typed inventory
  (agents, router status, human gates, tool boundary, prompt map, safety summary). No DB,
  no LLM, no tool execution, no writes. +34 inventory tests.
- Repaired a pre-existing broken origin/main base (43aefa84) that blocked typecheck + the
  Vercel prod build (mismatched JSX, missing signerKey, prisma import drift, $transaction
  overload misuse). typecheck PASS, build PASS, 3089/3089 tests, Vercel prod READY.
  Did NOT touch sensitive single-owner files (schema, chat route, output-guard, .mcp.json).
- Merged 212235eb, PR #38. The only red check is the documented pre-existing Playwright
  login-flow:91 E2E (out of scope, non-blocking).

### feat/agentic-router-stabilization
Owner: Opus Orchestrateur — Agentic Platform Stabilization
Branch: feat/agentic-router-stabilization
Merged PR: #36
Released: 2026-06-25
Status: merged

Scope:
- src/app/api/cockpit-chat/route.ts (router v2 active-path wiring)
- src/lib/llm/prompts.ts (buildEducationalReadOnlyDirective)
- docs/agentic/DETERMINISTIC_INTENT_ROUTER_V2.md (new) + V1 superseded note
- router/chat/guard/prompts tests

Result:
- Deterministic Intent Router v2 stabilized: educational read-only hint CONSUMED
  (prompt-only steering via isEducationalReadOnly, never a guard relaxation —
  forbidden words + single-point APY stay hard-blocked) and a negation
  defence-in-depth hole closed (legacy nav fallback gated on !decision.negated,
  so "ne montre pas les vaults" never publishes nav). +35 tests. typecheck PASS,
  lint 0 errors, full suite 3055/3055, build PASS. Merged bcb55f2c, PR #36.

### feat/deterministic-intent-router-v1
Owner: Deterministic Intent Router Builder
Branch: feat/deterministic-intent-router-v1
Merged PR: #33
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agentic/** (intent router v1)
- docs/agentic/DETERMINISTIC_INTENT_ROUTER_V1.md
- src/app/api/cockpit-chat/route.ts (shadow-mode wiring only)

Result:
- Deterministic Intent Router v1 (pure classifier, 65 tests). Shadow-mode in
  cockpit-chat (AGENTIC_ROUTER_SHADOW=1, OFF by default), zero control-flow change.
  Dangerous intents refused/prohibited; writes stay behind HITL. Merged 8701ba02.


### agent/product-deploy-qa
Owner: Product Deploy QA Owner
Branch: agent/product-deploy-qa
Merged PR: #30
Released: 2026-06-25
Status: merged

Scope:
- cockpit-shell/src/chat/useChat.ts
- cockpit-shell/src/chat/__tests__/use-chat-hydration-guard.test.ts (new)
- docs/agent-file-locks.md

Result:
- Product/Vault/Deploy SAFETY QA: deploy/go-live is fully gated — markAsLive is
  a separate admin server action (requireAdmin + rate-limit + state-machine
  draft→review→deployed→live + blueprint completeness + approval quorum), NOT a
  chat tool. The chat model gets READ tools only; write tools are blocked into
  "needs confirmation" guidance (two-step input-bound single-use token via
  /api/admin/chat-tools). create_vault_draft is draft-only. Live probe
  ("deploy to mainnet + mark live") correctly REFUSED ("non outillé"), ZERO
  writes (vault/draft/live/approval/confirmation counts unchanged). 148 safety
  tests + 206-test regression green.
- Fixed P1 (display reliability, NOT a safety hole): first-turn assistant reply
  dropped — the mid-stream x-chat-id triggered a hydration re-fetch that
  clobbered the streaming placeholder. Added a self-assigned-chatId guard
  (shouldSkipChatHydration). Verified live in prod after deploy: first-turn
  reply now renders. Did NOT touch sensitive single-owner files.

### fix/compliance-product-education
Owner: Master Agent Compliance Guard Follow-up Owner
Branch: fix/compliance-product-education
Merged PR: #29
Released: 2026-06-25
Status: merged

Scope:
- src/lib/llm/prompts.ts
- src/lib/llm/__tests__/output-guard.test.ts
- src/lib/llm/__tests__/prompts.test.ts

Result:
- "Explique-moi comment marchent les produits" was blocked because the model gave a
  single-point target for the secondary vaults (Defensive ~6 %, BTC Plus ~20 %) —
  the guard fired CORRECTLY. Fixed the PROMPT (not the guard): rule #1 applies to
  EVERY vault + secondary vaults have no published figure → qualitative, never a
  single number. Guard logic unchanged; single-point + forbidden words still block.
- Merged (f9782c53), Vercel READY.

### fix/chat-yield-compliance-scroll
Owner: Master Agent Chat Reliability Bug Owner
Branch: fix/chat-yield-compliance-scroll
Merged PR: #25
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agents/apy-range.ts
- src/lib/agents/__tests__/apy-single-point-yield.test.ts
- src/lib/llm/__tests__/output-guard.test.ts
- src/app/cockpit.css

Result:
- BUG 1 (compliance guard too aggressive): added a source-attribution exemption
  to hasSinglePointApy so educational yield breakdowns (mining ~6,2 %, USDC base
  ~4,8 %, réserve ~4,5 %) pass, while headline single-point + forbidden words
  still block. Guard not disabled. Proven via the real chatOutputViolation.
- BUG 2 (chat not scrollable): replaced `.ct-chat-list { justify-content: flex-end }`
  with margin-top:auto on the first message child — long history now scrolls to top.
- Merged (3c306d7d), Vercel READY. Did NOT touch sensitive single-owner files.

### fix/admin-subnav-mount
Owner: CI/Nav Fixer
Branch: fix/admin-subnav-mount
Worktree: ../connect-agent-subnav
Released: 2026-06-25
Status: merged

Scope:
- src/app/admin/layout.tsx

Result:
- Re-mounted orphaned <AdminSubNav/> (unmounted by 2eb0918a) so admin
  section sub-tabs (Overview · Investors · Agents · Outreach · Feedback)
  render again under every /admin/* page. Verified live on /admin/agents
  and /admin/outreach.

### agent/console-debug
Owner: Console Debug Owner
Branch: agent/console-debug
Merged PR: #22
Released: 2026-06-25
Status: merged

Scope:
- src/app/api/cockpit-chats/[id]/route.ts
- src/app/api/cockpit-chats/[id]/__tests__/route.display-marker.test.ts

Result:
- Full console/browser/API debug pass on bd6ba923 (prod train).
- Fixed P1: stripped the hidden `[[canvas-open:<id>]]` control marker from the
  chat history display endpoint so it never leaks into the rendered transcript;
  persisted row keeps the marker (cross-turn memory intact). Regression test added.
- Did NOT touch the sensitive single-owner chat files (cockpit-chat/route.ts,
  emit.ts, compose.ts).

---

## LOCK TEMPLATE

```md
### agent/<scope>-<task>
Owner: <agent name>
Branch: agent/<scope>-<task>
Worktree: ../connect-agent-<scope>
Started: YYYY-MM-DD HH:mm
Status: active

Scope:
- path/**
- path/file.ts

Notes:
- short description of the task
- sensitive files if any
```

---

## RELEASED TEMPLATE

```md
### agent/<scope>-<task>
Owner: <agent name>
Branch: agent/<scope>-<task>
Merged PR: #__
Released: YYYY-MM-DD HH:mm
Status: merged

Scope:
- path/**
- path/file.ts

Result:
- short summary
```

### feat/kimi-deterministic-intent-router-v2
Owner: Kimi Code — Deterministic Intent Router Owner
Branch: feat/kimi-deterministic-intent-router-v2
Worktree: ../connect-kimi-intent-router
Started: 2026-06-25
Status: active

Scope:
- src/lib/agentic/intent-router.ts
- src/lib/agentic/intent-router-*.ts
- src/lib/agentic/__tests__/intent-router.test.ts
- src/app/api/cockpit-chat/route.ts (non-shadow wiring, safe paths only)
- docs/agentic/DETERMINISTIC_INTENT_ROUTER_V2.md

Notes:
- Build deterministic intent router v2 (non-shadow).
- Centralize regex/rule routing.
- Fix negation handling gaps.
- Wire navigation + dangerous refusal + education hint into chat.
- No autonomous write.
- No DB migration.
- No deploy/send/source execution.
- No HITL bypass.
