# Swarm calibration campaign

Read-only / simulation-only calibration of the agentic swarm chain, run live
against the backend (registry → simulate → observability → aggregates). No UI,
no Prisma, no DB write, no business mutation, no external tool.

Reproduce: `pnpm test -- src/lib/agentic/__tests__/swarm-calibration.test.ts`
(pure safety net) and, against a running admin server,
`BASE_URL=http://localhost:4105 node scripts/agentic/calibrate-swarms.mjs`.

## Baseline

- `origin/main`: 970e7eb2 (agentic backend complete).
- Registry: **22 agents, 6 crews, 5 swarms, 21 actions**.
- Swarms (all modes ∈ {simulation, dry_run, gated}; **none** `autonomous_write`):

| swarm | mode | crews | gate/conf | swarm-blockedActions |
| --- | --- | --- | --- | --- |
| platform_reporting_swarm | simulation | reporting_crew_briefing | 0 / 0 | 10 |
| lp_explainer_swarm | simulation | risk_explanation_flow | 0 / 0 | 8 |
| vault_governance_swarm | dry_run | product_review_flow + vault_readiness_flow | 0 / 0 | 15 |
| outreach_governed_swarm | gated | outreach_draft_flow | 1 / 1 | 11 |
| memory_maintenance_swarm | dry_run | memory_distill_flow | 0 / 0 | 8 |

- `product_projection_swarm`: **ABSENT** (not merged) — unknown swarm → HTTP 404.

## Action catalog (21, by tier)

- **read_only (7)**: compose_reporting_briefing, explain_product, explain_yield,
  inspect_tool_boundary, navigate_admin_surface, read_observability, review_router_quality
- **draft_or_proposal (5)**: create_campaign_draft, create_governance_proposal_draft,
  create_review_note_draft, create_vault_draft, draft_outreach_email
- **confirmed_write (1)**: outreach_trigger_send_run
- **forbidden_autonomous (8)**: db_migration, deploy_product, formula_model_change,
  governance_execution, mark_vault_live, safe_signature, source_leads_autonomously, tier_a_auto_send

## Simulation matrix (identical readiness across all 5 swarms)

| case | HTTP | readiness → reasonCode |
| --- | --- | --- |
| no action | 200 | — (sideEffects=false, businessSideEffects=false) |
| read_only | 200 | allow → read_only_allowed |
| draft_only | 200 | gated → draft_requires_gate |
| confirmed_write (no token) | 200 | requires_human_confirmation → confirmed_write_needs_human |
| confirmed_write (token) | 200 | allow → confirmed_write_token_present (autonomousAllowed=false) |
| forbidden (token) | 200 | **blocked → forbidden_autonomous** (token does NOT unblock) |
| unknown action | 200 | **blocked → unknown_action:forbidden_autonomous** (fail-safe) |
| unknown swarm | **404** | — (no fallback execution) |

## Safety (all PASS)

- `forbidden` stays **blocked even with a confirmation token** (every forbidden action).
- `confirmed_write` is **gated without a token**, `allow` with one — never autonomous.
- `unknown` action → **blocked fail-safe**; `unknown` swarm → **404**.
- `sideEffects:false` and `businessSideEffects:false` everywhere.
- **No prompt / user text / raw payload / secret** in any simulate, simulations,
  or aggregates response.
- Audit codes per swarm are differentiated: `swarm_simulation` / `swarm_dry_run` /
  `swarm_gated` + `crew_read_only` / `crew_requires_gate`.

## Observability + aggregates (all PASS)

- Opt-in `{observability:{record:true}}` records all 5 swarms (storage: redis),
  traces **metadata-only**, no leak.
- `GET /simulations` metadata-only; `GET /simulations/aggregates`:
  `limit` clamp [1,200] OK, `window` 1h/24h/7d/all filtering OK
  (1h window correctly returned the freshly-recorded subset), `bySwarm`/`byMode`/
  `byReadinessOutcome`/`topReasonCodes` correct, invalid `limit`/`window` → 400,
  no `id`/`createdAt`/prompt leak.

## Structural finding

**Readiness is swarm-independent.** `evaluateActionReadiness(actionId)` ignores
which swarm is being simulated — the same action returns the identical decision
against every swarm, and a swarm's `forbiddenActions` metadata is **not** consulted
by the readiness evaluator. The swarms are also thin: every one wraps a single
crew except `vault_governance_swarm` (2), and `coordination` is always
`sequential`. This is safe (everything still fails closed) but means the swarm
layer currently adds little differentiated behaviour over its crews.

## Verdict

Adversarial multi-agent review (per-swarm analysts + red-team safety + reason-code
critic + synthesis) over the runtime evidence above.

### Readiness

| swarm | verdict | deciding reason |
| --- | --- | --- |
| outreach_governed_swarm | **weak** (top) | only `gated` swarm with a real draft→confirmed_write gate, but the "governed" gate is the *global* per-action tier, not the swarm — strip the wrapper and safety is unchanged |
| platform_reporting_swarm | **weak** | composes a live, useful read surface; least harmed by swarm-blindness, but a 1-crew sequential wrapper ≈ calling the crew directly, and no surface renders it |
| vault_governance_swarm | **theoretical** | only multi-crew swarm, but it `uniqueStable`-unions two read-only crews (concatenation, not coordination) and nothing imports it |
| lp_explainer_swarm | **theoretical** | its real safety value (APY-range + output guard) lives in the crew/guard layer it doesn't control; unwired |
| memory_maintenance_swarm | **theoretical** (weakest) | its core capability is fictional — no read path, no persistence, no distillation; `dry_run` is aspirational |

> Independent finding from the review: `simulateSwarm` / `SWARM_DEFINITIONS` are
> imported by **nothing** in `src/app` or `src/components` — the swarms are a pure
> module + tests + the 4 admin API routes. No page or chat surface invokes a swarm
> yet. They are safe and correct, but not yet reachable by a human at runtime.

### #1 structural weakness

**Readiness is swarm-independent by construction.** `evaluateActionReadiness`
never receives the swarm and never consults `swarm.forbiddenActions`, so
`outreach_trigger_send_run` evaluates byte-identically against
`memory_maintenance_swarm` as against `outreach_governed_swarm`. The per-swarm
`forbiddenActions` lists are **decorative metadata** (the `blocked` counts never
change a decision). Safe today only because the global tier floor fails closed and
nothing executes — but it becomes a containment hole the moment per-swarm
execution is wired. **The swarm boundary must become enforcement (tier ∩ swarm
allowlist), not a label.**

### Missing actions / tiers

- `confirmed_write` tier is **starved**: exactly one action (`outreach_trigger_send_run`),
  so only outreach can ever exercise the HITL gate.
- `draft_or_proposal` tier (5 ids) is **never emitted** at runtime — crews produce
  artifact-name strings, not catalog draft actions.
- **No projection action** exists in any tier.
- No swarm-scoped **allowlist** primitive (only negative free-text `forbiddenActions`
  that nothing reads).

### Confusing / vague / dead reason codes

- `unknown_tier_blocked` — **dead** exhaustiveness branch; keep as fail-closed guard
  but alarm-if-seen, never show in `topReasonCodes`.
- `confirmed_write_token_present` — misleading (reads as "autonomy granted" while
  `autonomousAllowed=false`); rename → `confirmed_write_human_authorized`.
- `swarm_simulation` / `swarm_dry_run` / `swarm_gated` — redundant config-echo of
  `swarmMode`; they dominate `topReasonCodes` and bury signal. Drop or re-purpose to
  encode outcome; exclude from `topReasonCodes`.
- `crew_mode_blocked` — conflates `forbidden` vs `confirmed_write_blocked`; split into
  `crew_blocked_forbidden` / `crew_blocked_missing_confirmation`.
- **Missing**: `action_out_of_swarm_scope` (the containment breach is currently
  invisible), `swarm_not_registered` (the 404), `crew_unavailable` (unknown-crew
  today returns with **zero** audit event).

### First improvement (highest leverage)

**`outreach_governed_swarm`** — it already owns the only `confirmed_write` action and
the only real gate. Steps: (1) thread the swarm into `evaluateActionReadiness` and
intersect `tierDecision ∩ swarmAllowlist` so every *other* swarm returns
`blocked/action_out_of_swarm_scope` for `outreach_trigger_send_run` — this single
change makes the boundary load-bearing and instantly differentiates all 5 swarms;
(2) replace free-text `forbiddenActions` with a catalog-id allowlist; (3) scope the
confirmation token to swarm+crew+action+single-use/expiring; (4) encode ADR-016
(`OUTREACH_AUTONOMY`, Tier-A-never-auto-send, daily cap, warm-up, suppression) at the
swarm layer; (5) wire the output compliance guard into the send path; (6) emit the
new scope/failure audit codes.

### `product_projection_swarm` — build **AFTER**, not now

Gating condition: do not build the swarm until (a) a projection **action** exists in
the catalog with a tier, (b) a projection **crew** exists to wrap, and (c) the swarm
boundary is enforcing (first-improvement step 1 landed). All three are false today.
A projection action is **`read_only`** by product law (pure-function engine, ADR-006;
output is a range + assumptions + "not guaranteed" disclaimer — non-negotiables
#1/#6/#10) → it never needs gated/confirmed_write machinery, so its value is engine +
output-guard correctness, not swarm governance. Order: ship swarm-scoped enforcement
→ add a `read_only` `run_projection` action backed by the real seeded pure engine with
output guard → wrap it in a `projection_flow` crew → *then*, only if there is
multi-crew/fan-out value, introduce `product_projection_swarm`.

