# Product Projection Swarm (v0)

A **read-only**, deterministic projection capability: an action, a crew, and a
swarm that produce a structured projection artifact from allowlisted inputs. It
invents no number, expresses APY only as a range (ADR-006), promises no return,
and performs no write, no external tool call, no execution, and no UI.

## Pieces

| Piece | Where | Role |
| --- | --- | --- |
| Action `run_projection` | `src/lib/agentic/action-readiness/actions.ts` | `read_only` catalog action (autonomousAllowed=false by policy) |
| Crew `projection_flow` | `src/lib/agentic/crew-simulation/scenarios.ts` | normalize input → build artifact → output guards (all `executable:false`) |
| Swarm `product_projection_swarm` | `src/lib/agentic/swarm/registry.ts` | `simulation` mode, enforced scope, composes `projection_flow` |
| Engine | `src/lib/agentic/product-projection/**` | pure deterministic artifact builder + validator + guards |
| API | `POST /api/admin/agentic/projection` | admin-gated, no-store, returns the artifact |

## Input contract (`ProductProjectionInput`)

Allowlisted only (unknown fields, prompts, conversation text are dropped):

```ts
{
  productName: string;                 // required
  productType: "vault"|"fund"|"strategy"|"unknown"; // required
  productId?: string;
  capitalBase?: number;                // ≥ 0
  currency?: "USD"|"USDC";
  apyRange?: { min: number; max: number }; // 0 ≤ min ≤ max ≤ 1000
  horizonMonths?: number;              // 1..1200 (defaults to 12, noted as an assumption)
  allocation?: { label, weightPct (0..100), source }[];
  assumptions?: { key, value, source }[];
}
```

`source ∈ live | attested | estimated | manual`.

## Artifact contract (`ProjectionReportArtifact`)

`{ id, kind:"product_projection_report", version:"v0", product, mode:"read_only_projection",
horizonMonths, confidence, summary, metrics[], scenarios[bear/base/bull], charts[],
assumptions[], risks[], disclaimers[], provenance[], missingInputs[], sideEffects:false,
businessSideEffects:false }`.

- **metrics**: `target_apy` (range), `capital_base` (value), `projected_yield` (range,
  derived `capitalBase × apyRange × horizon/12`, simple non-compounded). Each carries
  provenance.
- **scenarios**: bear/base/bull are framings of the **same provided range** (bear = low
  end, bull = high end, base = full range) — no number is invented.
- **charts**: `scenario_compare`, `range_band`, `allocation_mix` — structured data objects,
  never HTML.

## Guardrails (always enforced)

- **Deterministic**: no `Date.now()`, no randomness — same input → identical artifact.
- **APY range only**: a single-point APY is rejected by the output guard.
- **No invented numbers**: every figure traces to an input or a labelled derivation;
  absent critical inputs go to `missingInputs` (never fabricated).
- **No guarantees / forbidden words**: the output guard blocks
  `guarantee/guaranteed/promise/certain/will deliver/risk-free/riskless` in any
  human-facing text. (Disclaimers are worded to convey "not assured" without the banned
  tokens.)
- **Mandatory disclaimers + provenance**: present on every artifact; the API refuses to
  emit an artifact that trips a guard (defence in depth, 500 + no leak).
- **Missing inputs**: `apyRange`, `capitalBase`, `allocation`, `horizonMonths` absences are
  surfaced honestly.

## Swarm scope (enforced)

```
allowedActionIds: navigate_admin_surface, run_projection, explain_risk,
                  explain_provenance, explain_yield
forbiddenActions: deploy_product, mark_vault_live, outreach_trigger_send_run,
                  source_leads_autonomously
```

Readiness: `run_projection` / `explain_*` → allow; outreach/vault drafts →
`action_out_of_swarm_scope`; deploy/mark-live → `forbidden_autonomous` (floor);
the send-run / sourcing → `forbidden_by_swarm`.

## Relation to future UI / Scenario Lab

The artifact is a **backend contract** — a future UI lot (Scenario Lab / a Projection
panel) can render `metrics`/`scenarios`/`charts` read-only. The Scenario Engine
(`src/lib/engine/*`, pure, seed-injected, Monte-Carlo allowed under Methodology v2) is the
natural deeper input source; v0 takes the inputs directly and stays a pure transform.

## What this is NOT (out of scope here)

- No UI / no chart rendering (data only).
- No write, no DB, no migration, no external tool, no execution.
- No live deploy, no mark-live, no real financial action.
- No `apyRange` invention — if absent, it is a missing input.
