# Crew Simulation Read-Only v0

## What is a crew simulation?

A **crew simulation** is a static, deterministic, read-only representation of what a crew *would* do if asked to perform a task — without executing anything.

It answers the question: *"If we were to run Reporting Crew, what would happen?"* — not by running it, but by describing the flow precisely.

## What this is NOT

- NOT CrewAI or any autonomous runtime.
- NOT an execution engine. No tool is ever called.
- NOT a prompt chain. No LLM call is made in the simulation itself.
- NOT a write system. No database row, no file, no outreach is created.
- NOT a proxy for real agent execution.

## Module structure

```
src/lib/agentic/crew-simulation/
  types.ts               — CrewSimulationMode, Risk, Step, Scenario, Result, Error
  scenarios.ts           — 6 hardcoded scenario definitions (pure data)
  simulate-crew-flow.ts  — simulateCrewFlow(id): Result | Error (pure function)
  safety.ts              — assertAllScenariosSafe, assertScenarioSafe, assertStepSafe
  index.ts               — barrel export
  __tests__/
    crew-simulation.test.ts — full test suite
```

## Core invariant

Every scenario and every step carries `executable: false`. This is a **TypeScript-level structural invariant**, not a runtime check. The safety module asserts it in tests.

## Scenarios

### 1. `reporting_crew_briefing`

| Field | Value |
|---|---|
| Mode | `read_only` |
| Risk | `none` |
| Gates | none |
| Trigger | Admin requests agentic platform briefing |
| Inputs | Observability, quality review, tool boundary, control center |
| Output | Structured executive briefing JSON |

All steps are `read_only`. No gate required. No write action possible.

### 2. `outreach_draft_flow`

| Field | Value |
|---|---|
| Mode | `draft_only` |
| Risk | `medium` |
| Gates | Human approval HITL token required before any send |
| Trigger | Admin requests a draft outreach email for a prospect segment |
| Inputs | CRM prospects, outreach templates, output guard |
| Output | Compliance-checked draft email |

Hard rules:
- Tier A outreach is **never** auto-sent.
- Sending requires a two-step HITL confirmation token.
- `OUTREACH_AUTONOMY` default is `SUGGEST` — nothing auto-sends.

### 3. `product_review_flow`

| Field | Value |
|---|---|
| Mode | `read_only` / `draft_only` |
| Risk | `low` |
| Gates | none |
| Trigger | Admin initiates vault product review |
| Inputs | Vault state, scenario engine results |
| Output | Structured review notes (draft) |

No vault state is modified. APY always expressed as a range. Provenance badge required on every metric.

### 4. `risk_explanation_flow`

| Field | Value |
|---|---|
| Mode | `read_only` |
| Risk | `low` |
| Gates | none |
| Trigger | User asks Master Agent to explain vault risk profile |
| Inputs | Risk parameters, mining health |
| Output | Human-readable risk explanation |

Output guard always runs. No financial advice is produced. No write action reachable.

### 5. `vault_readiness_flow`

| Field | Value |
|---|---|
| Mode | `read_only` |
| Risk | `high` |
| Gates | none (assessment only — gate lifting is a separate human action) |
| Trigger | Admin requests readiness assessment before vault state change |
| Inputs | Smart contract state (Base Sepolia), ADR gate registry |
| Output | Advisory readiness report |

Mainnet deploy is **hard-blocked** (ADR-006: Spearbit audit required). `mark_vault_live` is unreachable from any crew or chat flow.

### 6. `memory_distill_flow`

| Field | Value |
|---|---|
| Mode | `read_only` |
| Risk | `low` |
| Gates | none |
| Trigger | System or admin triggers a memory distillation pass |
| Inputs | Session context metadata (no user message text) |
| Output | Concise internal summary |

No user text is stored. Summary stays in admin session — no external transmission.

## Safety model

### Modes

| Mode | Meaning |
|---|---|
| `read_only` | Step only reads data. No write possible. |
| `draft_only` | Step produces a draft that is NOT persisted until human explicitly saves. |
| `confirmed_write_blocked` | Step represents a point where a write WOULD happen but is structurally blocked until a human gate is passed. |
| `forbidden` | Step is never allowed under any circumstances. |

### Risk levels

| Risk | Meaning |
|---|---|
| `none` | No risk surface. Pure read, no sensitive data accessed. |
| `low` | Minor: advisory output, guard runs, no write. |
| `medium` | Write capability exists but is gated; outreach draft is generated. |
| `high` | Touches contract state or live vault context; output must be handled carefully. |
| `critical` | (Reserved — no current scenario uses this.) |

### Gates

A gate (`gateRequired: true`) means a human must explicitly approve before the next step can run. In `outreach_draft_flow`, the gate step is `confirmed_write_blocked` — sending is structurally impossible until the gate is passed.

## Blocked actions (representative list)

| Action | Blocked in |
|---|---|
| `auto_send_outreach` | outreach_draft_flow |
| `send_without_hitl_token` | outreach_draft_flow |
| `send_tier_a_outreach` | outreach_draft_flow |
| `deploy_to_mainnet` | vault_readiness_flow |
| `mark_vault_live` | vault_readiness_flow, product_review_flow |
| `execute_on_chain` | vault_readiness_flow |
| `sign_transaction` | vault_readiness_flow |
| `give_financial_advice` | risk_explanation_flow |
| `guarantee_return` | risk_explanation_flow |
| `store_user_message_text` | memory_distill_flow |
| `execute_tool` | reporting_crew_briefing |
| `write_database` | reporting_crew_briefing |

## API

```ts
import {
  simulateCrewFlow,
  listSimulationScenarioIds,
  isCrewSimulationError,
  assertAllScenariosSafe,
} from "@/lib/agentic/crew-simulation";

// Get a full simulation result
const result = simulateCrewFlow("reporting_crew_briefing");

if (isCrewSimulationError(result)) {
  // Unknown or forbidden scenario — no execution fallback
  console.error(result.message);
} else {
  // Safe to use
  console.log(result.scenario.steps);
  console.log(result.blockedActions);
  console.log(result.requiredGates);
}

// List all available scenario ids
const ids = listSimulationScenarioIds();

// Assert safety of all scenarios in tests
const violations = assertAllScenariosSafe(CREW_SIMULATION_SCENARIOS);
// expects: []
```

## Future visual integration

This module is designed to feed a visual flow console in `/admin/agentic`. Each `CrewSimulationResult` maps directly to a visual flow:

- `scenario.steps` → timeline nodes
- `requiredGates` → gate checkpoint markers
- `blockedActions` → red "forbidden" badges
- `scenario.risk` → risk indicator chip
- `scenario.mode` → mode badge

The UI integration is out of scope for this lot (v0). When it is built, it will consume this module as a pure read import — no additional logic should be added here.

## Guarantees

1. `simulateCrewFlow` never calls any tool handler.
2. `simulateCrewFlow` never writes to any database or file.
3. `simulateCrewFlow` never makes an LLM call.
4. `simulateCrewFlow` never sends any outreach.
5. `simulateCrewFlow` never deploys or signs any transaction.
6. Every `scenario.executable` is `false` (TypeScript structural + test-asserted).
7. Every `step.executable` is `false` (TypeScript structural + test-asserted).
8. Unknown scenario IDs return a typed `CrewSimulationError` — no fallback execution.
9. The module is pure: no side effects, no I/O, no server-only imports.

## Visual integration (V1)

Surfaced read-only in `/admin/agentic`: each scenario feeds a **Crew Simulation**
flow node on the visual system map and a dedicated **Crew Simulation** section that
renders the 6 flows as step rails with gates, blocked actions, and a prominent
`executable: false` marker. There is no run/launch/execute control. See
[`AGENTIC_VISUAL_CONTROL_CENTER_V0.md`](./AGENTIC_VISUAL_CONTROL_CENTER_V0.md)
(Visual Integration V1).
