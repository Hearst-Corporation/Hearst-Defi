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

## Methodology v2 (seeded p5 / p50 / p95)

An additive, opt-in `methodology: { version: "v2", seed, iterations }` input adds a
**seeded** p5/p50/p95 distribution + per-horizon bands + a `percentile_band` chart on
top of the v0 range — pure, deterministic (reuses `src/lib/engine/prng.ts`, no
`Math.random`/`Date.now`), APY sampled only within the provided range, no invented
number, no promise. Omitting `methodology` (or `version:"v1"`) keeps the v0 behaviour
unchanged. Full contract + guards: [PROJECTION_METHODOLOGY_V2.md](./PROJECTION_METHODOLOGY_V2.md).

## Read-only UI wiring (Projection Preview)

Route: **`/admin/projection/preview`** (Strategy → "Projection Preview" sub-nav tab).
A read-only admin surface that renders the existing `ProjectionReportArtifact` from
`POST /api/admin/agentic/projection` for a clearly-labelled **Preview input**
(`PREVIEW_PROJECTION_INPUT` in `src/lib/agentic/product-projection/client.ts` —
Hearst Yield Vault, 8–15%, 12m, 1,000,000 USDC, 70/30 allocation). It does NOT touch
the existing `/admin/projection` Projection Studio.

- **Client**: `client.ts` `runProjectionPreview()` — a single on-demand POST (no
  mutation, no storage, no auto-polling). 200 → artifact; 400 → invalid state; 500 /
  network → generic error state. No raw payload or stack trace is ever shown.
- **View** (`src/components/admin/projection/projection-report-view.tsx`, pure):
  hero summary + Read-only / No-side-effects / Preview badges; headline metric cards
  (Capital base · Target APY range · Projected yield range · Horizon); Bear/Base/Bull
  scenarios; chart payloads rendered CSS-only (range band, allocation mix, scenario
  compare — `missing input` note when a chart has no data, never a fake chart);
  Assumptions, Risks (severity), Provenance (per metric), Missing inputs, and the
  mandatory Disclaimers. APY is shown only as a range; nothing is framed as guaranteed.
- **States**: idle / loading (skeleton) / success / invalid (400) / error (500/network).
- **Design**: token-only (`var(--ct-*)`), graphite-opaque DS panels, single green
  accent, 4px grid, responsive (no horizontal overflow); scoped CSS
  `src/app/admin/projection/projection-preview.css`.

### Methodology v2 rendering (v0/v2 toggle)

The preview surface has a **Deterministic v0 / Methodology v2** toggle. Switching mode
resets the report to idle. The UI computes nothing — it consumes the artifact's
`methodology` + `distribution` verbatim. v2 adds a methodology block with the **visible,
editable seed** (default `preview-hyv-v2`, `iterations: 2000`, `confidenceBands: true`),
so the distribution is reproducible.

When `artifact.version === "v2"`, a **Methodology v2** section renders (read-only):
seed / iterations / model badges; p5 / p50 / p95 percentile cards (APY% + projected
yield), with **p50 explicitly captioned "Median scenario"** and a note that p50 is
the median of a conditional distribution — *not an expected return or a target*, p5/p95
a projection band; a **CSS-only percentile band visual** built from
`distribution.bands` (per-horizon-month p5→p95 band + p50 marker, axis label, legend —
no chart library, no SVG, finite-guarded so no `NaN`/`Infinity` ever renders); and the
backend `limitations`. If a v2 artifact carries no `distribution` (e.g. missing APY
range), the section shows a "no distribution available" fallback — never a fabricated
band. The generic Charts block still filters out `percentile_band`; the band is owned
by the v2 section. APY stays a distribution/range; nothing is framed as guaranteed.

### Editable bounded preview inputs

The preview input is **editable, draft-only, and bounded** — no storage, no mutation;
the engine and API are untouched. Fields: **Capital base** (0–1,000,000,000), **APY min**
and **APY max** (0–100, with **min ≤ max** enforced), **Horizon** (1–120, integer), and
(v2 only) **Seed** (3–64 chars, `[A-Za-z0-9_-]` only). Non-editable fixture parts
(product, currency, 70/30 allocation, assumptions) are preserved and the allocation is
labelled "preview fixture (not editable)".

Validation is **local and pure** (`validatePreviewDraft` in `client.ts`): it runs BEFORE
any request and, on failure, shows per-field + summary errors and **never calls the API**.
`NaN`/`Infinity`/scientific-notation/text are rejected; APY is always a min/max range.
On success, `buildPreviewInput(value, mode)` maps the validated values to the API input
(v0 → no methodology; v2 → methodology with the validated seed). Editing an input after a
successful run flags the report **stale** ("run again to refresh"); **Reset** restores the
default draft and returns to idle. No raw JSON / prompt / user text is ever shown.

**Future** (not in this lot): a richer Scenario Lab integration sharing this band visual,
and optional editable allocation weights (still read-only/draft).

## Relation to future UI / Scenario Lab

The artifact is a **backend contract** — this lot renders the v0 report read-only; a
later lot can render `distribution.bands` (Methodology v2) and a richer Scenario Lab.
The Scenario Engine (`src/lib/engine/*`, pure, seed-injected, Monte-Carlo) is the
natural deeper input source for a market-calibrated v2 distribution; v0/v2 here take the
inputs directly and stay a pure transform.

## What this is NOT (out of scope here)

- No UI / no chart rendering (data only).
- No write, no DB, no migration, no external tool, no execution.
- No live deploy, no mark-live, no real financial action.
- No `apyRange` invention — if absent, it is a missing input.
