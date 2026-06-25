# Tool Boundary v1 (read-only)

A read-only **reflection of the real LLM tool registry** in `/admin/agentic`.
Where v0 showed a hand-written tier description, v1 is driven by the actual tool
ids declared in the code, classified into tiers with their gate / risk / runtime
status, plus consistency warnings that flag when the displayed boundary drifts
from the registry.

**This executes nothing.** No tool handler is referenced, no token is created, no
write is performed. It changes no router/guard/HITL/chat behaviour and adds,
removes, or modifies no tool.

## Where it lives

- **Module (pure):** `src/lib/agentic/tool-boundary/`
  - `registry-reflection.ts` — reflects the real ids from the side-effect-free
    `ADMIN_READ_TOOL_IDS` / `ADMIN_WRITE_TOOL_IDS` (in `src/lib/llm/tools/types.ts`)
    joined with a curated, **tested** metadata map. It deliberately does NOT import
    the `server-only` `registry.ts` (which pulls `prisma` + server actions and runs
    side effects on import).
  - `classify-tool.ts` — maps each reflected tool into a tier + gate + risk, and
    lists the forbidden-autonomous actions (represented, not callable tools).
  - `consistency.ts` — static-vs-code + safety-invariant checks → issues.
  - `summary.ts` — composes counts + tools + issues + safety notes.
- **Control Center wiring:** `control-center/tool-boundary-summary.ts`
  exposes `getToolBoundaryV1Summary()`; the aggregator attaches it as
  `AgenticControlCenterData.toolBoundaryV1` (additive, the legacy static
  `tools` tier list is unchanged).
- **UI:** `src/components/admin/agentic/tool-boundary-section.tsx`, rendered
  inside the existing Tool boundary section of `/admin/agentic`.

## Why reflection is driven by the id arrays (not registry.ts)

`registry.ts` is `server-only` and imports `prisma` + server actions; importing it
into the pure Control Center (or a client-safe reflection) would pull heavy server
deps and break purity. The id arrays (`ADMIN_READ_TOOL_IDS` / `ADMIN_WRITE_TOOL_IDS`)
are **pure const arrays with no side effects** — they are the authoritative list of
tool ids and the read/write split. Per-tool metadata (risk, description) is mirrored
in a curated map; **completeness tests fail** if any real id is missing from the map
or any extra id appears, so the reflection can never silently drift from the code.

## Tiers

| Tier | Meaning | Gate | Autonomous |
| --- | --- | --- | --- |
| `read_only` | bounded reads / read-only generation, no DB write | none | yes (may be called, can only read) |
| `draft_or_proposal` | persists a DRAFT/proposal state only | HITL token | no |
| `confirmed_write` | a confirmed write with an external effect | HITL token | no |
| `forbidden_autonomous` | an action that must never be autonomous — **not a callable tool** | human only | no |
| `unknown` | a real tool with no classification — **fails safe** | required | no |

Current reflection: **11 read_only**, **6 draft_or_proposal**, **1 confirmed_write**
(`outreach_trigger_send_run`), **0 unknown**, plus **8 forbidden-autonomous actions**
represented (financial/custodial, Safe signature, vault markAsLive, mainnet deploy,
DB migration, governance execution, formula/methodology change, Tier A auto-send).

## How a new tool is classified safely

1. Add the tool id to `ADMIN_READ_TOOL_IDS` or `ADMIN_WRITE_TOOL_IDS` (registry).
2. Add a matching entry to `REFLECTED_TOOL_META` in `registry-reflection.ts`
   (`kind`, `riskLevel`, `description`, `externalEffect`).
3. If you skip step 2, the completeness test fails AND the boundary shows the tool
   as `unknown` (high risk, non-autonomous) with a consistency **warning** — it
   never silently passes.

Required invariants (enforced by `consistency.ts`):

- every write-like tool is `humanGateRequired` (else **critical**);
- a `confirmed_write` (or any non-read) tool is never `autonomousAllowed` (else **critical**);
- a forbidden action is never `autonomousAllowed` (else **critical**);
- a real tool absent from the static display, or a static id absent from the real
  registry, is a **warning** (drift).

## Safety / non-goals

- **No tool execution.** No handler is referenced; nothing runs.
- No tool added / removed / changed; no registry runtime change.
- No router / guard / HITL / chat behaviour change.
- No tool-execution UI, no run/send/deploy/source button, no replay, no export.
- No DB migration, no Prisma/schema change, no new table.
- No prompt editing, no CrewAI / external swarms.
- No user text / prompt / tool payload — only ids, tiers, gates, risks, sources.

## Next lot recommendation

`Reporting Crew (read-only) v0` (roadmap #10): a read-only "reporting" surface that
**composes** existing read tools' outputs into a structured briefing, still with NO
execution of write tools and NO autonomy — purely assembling read results. Only
after Tool Boundary v1 makes the read surface explicit. Do NOT wire any Crew
runtime / CrewAI / write tool / autonomous loop yet.
