# Projection Methodology v2 — seeded p5 / p50 / p95

An **additive, opt-in** methodology layer on the read-only product projection. It
adds a **seeded** p5/p50/p95 distribution + per-horizon bands on top of the v0
deterministic range. Pure and deterministic: it reuses the existing seeded PRNG
(`src/lib/engine/prng.ts`, mulberry32) — **no `Math.random`, no `Date.now`**.
APY stays a distribution within the provided range; no number is invented; no
return is promised; nothing is executed; no UI.

## How to call

`POST /api/admin/agentic/projection` — additive `methodology` field (omit → v0):

```jsonc
{
  "productName": "Hearst Yield Vault",
  "productType": "vault",
  "apyRange": { "min": 8, "max": 15 },
  "capitalBase": 1000000,
  "currency": "USDC",
  "horizonMonths": 12,
  "methodology": {
    "version": "v2",            // omit / "v1" → v0 behaviour
    "seed": "demo-seed",        // string or number; omitted → derived from inputs
    "iterations": 2000,         // clamped to [100, 10000]
    "confidenceBands": true
  }
}
```

`version: "v2"` response adds (additive, v0 fields unchanged):

```jsonc
{
  "artifact": {
    "version": "v2",
    "methodology": { "version": "v2", "seed": "demo-seed", "iterations": 2000,
                     "model": "seeded_scenario_distribution", "limitations": [ "…" ] },
    "distribution": {
      "percentiles": {
        "p5":  { "label": "p5",  "apyPct": 8.52,  "projectedYield": { "value": 85200,  "unit": "USDC" } },
        "p50": { "label": "p50", "apyPct": 11.45, "projectedYield": { "value": 114500, "unit": "USDC" } },
        "p95": { "label": "p95", "apyPct": 14.31, "projectedYield": { "value": 143100, "unit": "USDC" } }
      },
      "bands": [ { "horizonMonth": 1, "p5": …, "p50": …, "p95": …, "unit": "USDC" }, … ],
      "assumptionsUsed": [ "apyRange=8-15%", "horizonMonths=12", "capitalBase=1000000 USDC" ]
    },
    "charts": [ …, { "id": "projection_percentile_band", "type": "percentile_band",
                     "title": "Scenario distribution (p5 / p50 / p95)", "data": { "bands": […], "percentiles": {…} } } ]
  },
  "sideEffects": false,
  "businessSideEffects": false
}
```

## Model

`seeded_scenario_distribution`: each iteration samples an APY **only within the
provided `apyRange`** (truncated normal centred on the range midpoint, sd =
range/4, clamped to `[min, max]`). Projected yield per iteration is the labelled
derivation `capitalBase × sampled APY × horizon/12` (simple, non-compounded).
Percentiles are linear-interpolated over the sorted samples; bands are the
per-month cumulative projection at p5/p50/p95.

## Guarantees (output guards, always enforced)

- **Seed required**: a seed is always present (explicit, or deterministically
  derived from the allowlisted inputs — `derived:<hash>`). Never random.
- **Deterministic**: same `(seed, iterations, inputs)` → byte-identical
  distribution. A different seed yields a different *sample*, not a different truth.
- **`iterations` clamped** to `[100, 10000]`.
- **`p5 ≤ p50 ≤ p95`**, every value finite (no `NaN` / `Infinity`).
- **APY only as a distribution/range** — never a single point presented as certainty.
- **No invented numbers**: absent `apyRange` → no distribution (recorded in
  `missingInputs` as `methodology_v2(needs apyRange)`); absent `capitalBase` →
  APY percentiles only, bands expressed as cumulative APY%.
- **Limitations stated**: `model`, "p50 is a median of a conditional distribution,
  not a forecast", and the sampling caveat are emitted in `methodology.limitations`.
- **Disclaimers + provenance + no forbidden words** — same v0 guards apply.

## What this is NOT

- Not a market model — APY is sampled inside a *stated* range, not estimated from data.
- Not a forecast / target — p50 is a conditional median, not a promise.
- No write, no DB, no migration, no external tool, no execution, no UI.

## Relation to the Scenario Engine / Scenario Lab

The deeper engine (`src/lib/engine/monte-carlo.ts`, seeded, mining/BTC-aware) is the
natural future source for a market-calibrated distribution under Methodology v2.0;
this lot reuses only its pure PRNG and keeps the projection a generic, transparent
transform of the provided range. A future UI lot (Scenario Lab / projection panel)
can render `distribution.bands` + the `percentile_band` chart read-only.
