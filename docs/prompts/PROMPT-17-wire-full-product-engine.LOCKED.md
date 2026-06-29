<!--
  ████ LOCKED REFERENCE — PROMPT 17 (the source prompt behind this PR) ████
  Frozen archive of the prompt that drove wiring the full product financial
  engine into the swarm construction pipeline. Do not execute; do not edit the
  frozen body. To change scope, author PROMPT 18+.
  Archived: 2026-06-30 · Branch: feat/btc-full-product-engine-pipeline
-->

# PROMPT 17 — Wire full product financial engine into swarm pipeline (LOCKED REFERENCE)

> Read-only archive. The product engines (stable funding, exit/recovery,
> waterfalls, operator economics) were pure modules NOT wired into the live-read
> construction pipeline. This prompt drove that wiring + the calculated-vs-
> documented disclosure. See the PR for what shipped.

## What shipped against this prompt

| Phase | Deliverable | File |
|---|---|---|
| A | Calculated-vs-documented manifest + report section | `src/lib/agentic/swarm/live/calculated-vs-documented.ts` · `components/.../product-engine-report.tsx` |
| B | Stable Funding Engine wired (PARTIAL + missing-inputs at construction time) | `src/lib/agentic/swarm/live/product-engine-bridge.ts` (wraps `products/stable-funding-engine.ts`) |
| C | Exit / Recovery wired (ACTIVE→TARGET_PROGRESS, no live triggers) | bridge (wraps `products/exit-recovery.ts`) |
| D | Waterfalls (normal / early / recovery), fixed ordering | `src/lib/products/btc-mining-waterfalls.ts` |
| E | Operator economics, separate object, never added to client APY | bridge (wraps `products/operator-economics.ts`) |
| F | Engine outputs surfaced in the report under collapsibles | `components/.../product-engine-report.tsx` (rendered in `construction-stepper.tsx`) |
| G | Monte-Carlo disclosed STATIC v1 (scenario-level, not path-dependent) | bridge `monteCarloDisclosure` |
| H | Diagnostics (waterfalls/order, operator-separate, MC honest, calc-vs-doc) | `src/lib/admin/diagnostics/btc-mining-vault-diagnostics.ts` (13 checks) |

## STOP conditions honoured
- operator economics NOT added to client APY (separate object, `validated:false`);
- recovery NEVER shown as a guarantee (`guaranteedRecovery:false`, note disclaimed);
- stable funding does NOT sell BTC by default (construction-time decision ≠ SELL_BTC);
- waterfalls never imply a guaranteed distribution (coverage-gated step `blocked`);
- Monte-Carlo NOT claimed path-dependent (`pathDependentRebalancing:false`);
- CONFIGURED never shown as VALIDATED; 8–12% never added to 20–24%;
- mining normal mode never below 30% (floor enforced upstream, untouched);
- no DB write / send / deploy (live-read floor asserted in the existing pipeline).

## Known limitations (verbatim, do not paper over)
- Funding/exit inputs are construction-time → flagged PARTIAL with missing live
  inputs (power runway, real coverage, LTV, maturity, capital-recovered);
- Monte-Carlo stays STATIC (no path-dependent rebalancing) — the only remaining
  documented-only item;
- Operator residual-value figures are CONFIGURED placeholders (doc §15 open Q).

---

## PROMPT 17 — verbatim (FROZEN)

The full prompt body is preserved in the conversation/PR description. This archive
intentionally keeps the implementation map above as the durable reference; the
literal prompt text is the one delivered in the task that opened this branch.
