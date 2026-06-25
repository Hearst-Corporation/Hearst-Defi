# Reporting Crew Read-Only v0

The first applicative "crew" in Hearst Connect — a **read-only briefing** in
`/admin/agentic` that composes the data the platform already produces (router
status, observability, quality review, tool boundary, gates, safety) into a
deterministic, plain-language report an admin can scan to answer:

1. Is the agentic system healthy?
2. Is the router behaving well?
3. Are dangerous intents controlled?
4. Are the tools well-bounded?
5. Are there signals to watch?
6. What read-only checks should I run next?

## Why this is NOT CrewAI

There is **no crew runtime**, no agent loop, no CrewAI, no external swarm. The
"crew" is a deterministic, pure composition: it reads already-computed summaries
and produces a structured `ReportingCrewBriefing`. It calls no LLM, executes no
tool, and performs no write. Same input → same output.

## Where it lives

- **Module:** `src/lib/agentic/reporting/`
  - `types.ts` — `ReportingCrewBriefing` / `ReportingCrewSection` / `ReportingCrewSignal`.
  - `collect-inputs.ts` — `server-only`, best-effort: gathers
    `getAgenticControlCenterData()` (pure) + `getRouterObservabilitySummary()`
    (best-effort, null on failure). No tool/LLM/write/HITL is invoked. Accepts a
    pre-fetched observability summary to avoid a second read.
  - `quality-signals.ts` — pure signal derivation
    (`deriveRouterSignals` / `deriveToolBoundarySignals` / `deriveSafetySignals` /
    `deriveNoDataSignals`).
  - `compose-briefing.ts` — pure, deterministic composition of the sections + status.
  - `recommendations.ts` — read-only follow-up checks (no write/dangerous verb).
  - `index.ts` — `getReportingCrewBriefing()` entry point.
- **UI:** `src/components/admin/agentic/reporting-crew-section.tsx`, rendered in
  `/admin/agentic` right after the Router Observability section (which already
  carries the Quality Review), before "Next architecture steps".

## What the briefing contains

- **Executive summary** — status + a plain-language paragraph.
- **Router Health** — router status/mode, unknown / dangerous-refusal / educational
  rates, observability source.
- **Tool Boundary Health** — read / draft / confirmed-write / unknown tool counts,
  consistency issues.
- **Safety & Gates** — safety claims that hold, autonomous gates (expected 0),
  forbidden actions represented.
- **Observability Signals** — trace storage, window, decisions, active quality signals.
- **Watchlist** — every watch/alert signal across sections (or "clear" when healthy).
- **Recommended read-only checks** — short list of safe verifications.

### Status derivation

`alert` if any section signal is `alert`; else `watch` if any is `watch`; else
`no_data` when there is no usable observability data; otherwise `healthy`.

## Read-only sources used

`getAgenticControlCenterData()` (router / inventory / gates / `toolBoundaryV1` /
safety) and `getRouterObservabilitySummary()` (state / storage / stats /
`qualityReview` / `aggregationMode`). Both are existing read-only accessors; the
briefing never issues a tool call, an LLM call, a write, or a HITL token.

## Safety / non-goals

- **No CrewAI, no autonomous runtime, no autonomous loop.**
- No tool execution, no write tools, no send / source / deploy / mark-live.
- No router / guard / HITL / chat behaviour change; no registry runtime change.
- No replay, no export, no prompt editing, no tool-execution UI.
- No DB migration, no Prisma/schema change, no new table.
- No user text / prompt / tool payload stored — only ids, counts, rates, labels.

The UI carries the verbatim note: *"Read-only composition only. No tools are
executed, no writes are performed, and no prompts, user messages, or tool payloads
are stored."*

## How to add a section

Add a `ReportingCrewSection` in `compose-briefing.ts` (a `summary`, `metrics`, and
`signals`), deriving its signals via a pure helper in `quality-signals.ts`. Keep it
read-only: read an existing summary, never call a tool/handler. The UI renders any
section in the grid automatically; the `watchlist` id is rendered with emphasis.

## How to test

`src/lib/agentic/reporting/__tests__/reporting-crew.test.ts` builds minimal inputs
and asserts healthy / watch / alert / no_data composition, signal derivation, and
that no recommendation contains a forbidden write verb
(send / source / deploy / mark live / execute / approve / mutate). The UI test
asserts the render contract + no write controls.

## Limits of v0

- The briefing reflects ONE observability window (default 24h) — it does not
  aggregate across windows.
- Admin visual QA of the live page is recommended but is surfaced honestly as an
  `info` signal rather than confirmed here.

## Next lot recommendation

`Reporting Crew — Multi-window briefing v0.1` (read-only): compose the briefing
across the 1h / 24h / 7d / 30d windows to spot trends, still with no tool execution
and no autonomy. Only after v0 is stable. Do NOT add a crew runtime / CrewAI / any
write tool / autonomous loop.
