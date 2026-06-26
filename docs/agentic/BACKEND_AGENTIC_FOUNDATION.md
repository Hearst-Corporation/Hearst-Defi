# Agentic backend foundation — agents, crews, swarms

Typed, pure, **read-only** backend for representing, simulating, and auditing how
agents / crews / swarms would coordinate — **without any dangerous execution**.
Nothing in this layer sends, deploys, writes to the DB, calls an external tool, or
reads the wall clock. It is the data/logic substrate that the `/admin/agentic`
Control Tower UI reads; the UI is **not** modified by this layer.

## Layers (where things live)

| Concept | Module | Role |
| --- | --- | --- |
| Agents inventory | `src/lib/agentic/control-center` | typed agent / gate / safety inventory |
| Actions + policies | `src/lib/agentic/action-readiness` | `ACTION_READINESS_ITEMS`, tiers, fail-safe classifier |
| Tool boundary | `src/lib/agentic/tool-boundary` | read/write tool reflection |
| **Crews** | `src/lib/agentic/crew-simulation` | 6 deterministic crew flows, `executable:false` |
| **Swarms** | `src/lib/agentic/swarm` *(this lot)* | composition of crews + simulation + readiness + audit |
| Observability | `src/lib/agentic/observability` | router decision traces / quality |
| System map | `src/lib/agentic/system-map` | UI topology derivation |

A **swarm** composes one or more **crews**; a **crew** is an ordered set of
non-executable **steps**; every step and action carries a **policy/mode**.

## Execution modes (the safe union)

Swarms can only declare one of — there is no `autonomous_write` member, so an
auto-writing swarm is **unrepresentable** in the type system:

| Mode | Meaning |
| --- | --- |
| `simulation` | pure modelling, no side effect, no gate semantics |
| `dry_run` | would-be plan with all effects explicitly suppressed |
| `gated` | at least one step needs a human gate before it could ever run |

Crew step modes (`src/lib/agentic/crew-simulation`):
`read_only` · `draft_only` · `confirmed_write_blocked` · `forbidden` — all with
`executable: false`.

Action tiers (`src/lib/agentic/action-readiness`):
`read_only` · `draft_or_proposal` · `confirmed_write` · `forbidden_autonomous`.

## Safety contract

`evaluateActionReadiness(actionId, context)` is the gate every would-be action
passes through (`src/lib/agentic/swarm/readiness.ts`). It reuses the existing
action registry + fail-safe classifier and never returns a permissive fallback:

| Tier | Decision | Notes |
| --- | --- | --- |
| `read_only` | `allow` | never autonomous-write |
| `draft_or_proposal` | `gated` | draft is fine; the effect needs a gate |
| `confirmed_write` | `requires_human_confirmation` | → `allow` ONLY with an explicit human token; still never autonomous |
| `forbidden_autonomous` | `blocked` | always blocked, **even with a token** |
| unknown, write-like | `blocked` | fail-safe (`classifyUnknownAction`) |
| unknown, non-write | `allow` (read-only), never autonomous | |

Swarm-level invariants (`src/lib/agentic/swarm/safety.ts`, all unit-tested):
- mode ∈ {simulation, dry_run, gated};
- every `crewId` exists in the crew registry (no fallback on a missing crew);
- vault/product swarms must forbid `deploy` + `mark_live`;
- outreach swarms must forbid `send`;
- a `gated` swarm must compose at least one crew that actually requires a gate.

`simulateSwarm(id)` is **deterministic** (no `Date`, no randomness) → identical
input yields byte-identical output; unknown swarm / unknown crew → typed
`SwarmSimulationError`, never an execution.

## How to add an agent

Agents live in `src/lib/agentic/control-center/inventory.ts`. Add the typed entry
there (id / name / domain / capabilities / policy). Do not duplicate the agent in
the UI — the Control Tower reads the inventory.

## How to add a crew

Add a `CrewSimulationScenario` to
`src/lib/agentic/crew-simulation/scenarios.ts`:
- every step `executable: false`;
- `confirmed_write_blocked` steps set `gateRequired: true`;
- list `forbiddenActions` (send/deploy/mark_live where relevant);
- the safety suite (`assertAllScenariosSafe`) must report zero violations.

## How to add a swarm

Add a `SwarmDefinition` to `src/lib/agentic/swarm/registry.ts`:
- `mode` ∈ {simulation, dry_run, gated};
- `crewIds` reference EXISTING crews only;
- list `forbiddenActions` per the safety rules above;
- `assertAllSwarmsSafe` and the swarm test suite must stay green.

Then it is simulatable via `simulateSwarm("<id>")` — no wiring, no API, no DB.

## Observability / audit

`simulateSwarm` emits a pure `AgenticAuditEvent[]` trail
(`{ kind, agentId?, crewId?, swarmId?, actionPolicy, executionMode, blocked,
gateRequired, reasonCode }`). It carries **only ids + machine reason codes** —
never prompts, user text, or secrets — and is **not persisted** (no DB write, no
migration). If a future lot persists it, that is a separate, explicitly-gated
decision.

## What stays forbidden here

- ❌ No real send / deploy / on-chain / mark-live from any swarm or crew.
- ❌ No autonomous write; `confirmed_write` always needs an explicit human token.
- ❌ No DB write, no migration, no external network, no tool execution.
- ❌ No prompt / user-text / secret in audit events.
- ❌ No CrewAI or external orchestration lib (this is a pure in-repo lib).

## Relation to the Control Tower UI

`/admin/agentic` is a **read-only visualisation** of this backend. This lot adds
backend modules only; the UI is untouched. A later UI lot may surface the swarm
layer (topology nodes / a swarm board), consuming `SWARM_DEFINITIONS` +
`simulateSwarm` read-only — that is out of scope here.
