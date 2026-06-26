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

### fix/outreach-regex-continuity
Owner: Opus Orchestrateur — Outreach Regex Router / Campaign Continuity
Branch: fix/outreach-regex-continuity
Reserved: 2026-06-26
Status: active
Files:
- src/lib/chat/outreach-regex-router.ts (new)
- src/lib/chat/__tests__/outreach-regex-router.test.ts (new)
- src/app/api/cockpit-chat/route.ts (outreach pre-router hook only)

---

### feat/vault-detail-grammar-convergence
Owner: Agent — Vault Detail Root Grammar Convergence
Branch: main (worktree shared — vault detail scope only)
Reserved: 2026-06-26
Files:
- src/app/(product)/vaults/[id]/page.tsx
- src/app/(product)/vaults/[id]/loading.tsx
- src/components/vaults/invest-flow-shell.tsx
- src/components/vaults/vault-legal-proof-rows.tsx
- src/components/ui/provenance-badge.tsx
- src/app/cockpit.css (provenance-badge--compact rename only)
- src/components/vaults/__tests__/invest-flow-shell.test.tsx

---

### squad/capital-yield-dimension-cleanup
Owner: Agent 1/4 — Capital & Yield Dimension Cleanup Squad
Branch: main (worktree shared — Capital & Yield scope only)
Reserved: 2026-06-26
Files:
- src/components/portfolio/capital-yield.tsx
- src/components/portfolio/__tests__/capital-yield.test.tsx
- src/app/(product)/portfolio/portfolio.css (cy-panel / cy-v5-* blocks only)
- src/app/(product)/portfolio/loading.tsx (cy-v5 skeleton only)
- src/app/(product)/portfolio/page.tsx (CapitalYield props / pf-cockpit-row--yield only — no other rows)

---

### squad/portfolio-value-chart-rebuild
Owner: Agent 3/4 — Portfolio Value Chart Rebuild Squad
Branch: main (worktree shared — chart scope only)
Reserved: 2026-06-26
Files:
- src/components/portfolio/value-chart.tsx
- src/components/portfolio/chart/**
- src/lib/portfolio/value-series.ts
- src/lib/portfolio/investor-nav-snapshot.ts
- src/lib/portfolio/geometry/value-series-projection.ts
- src/lib/portfolio/geometry/svgConstants.ts
- src/lib/data/portfolio.ts (hourlyValueSnapshots feed)
- src/lib/inngest/functions/investor-nav-snapshot-hourly.ts
- prisma/schema.prisma (InvestorNavSnapshot model)
- prisma/migrations/20260626120000_add_investor_nav_snapshot/**
- src/app/api/inngest/route.ts (register investor-nav-snapshot-hourly)
- src/app/(product)/portfolio/page.tsx (ValueChart prop wiring only)
- src/app/(product)/portfolio/portfolio.css (pf-value-chart / pf-vc-* blocks only)
- scripts/seed-dev-position.ts (hourly NAV dev_seed backfill)
- related tests under src/components/portfolio/__tests__/value-chart.test.tsx
- src/lib/portfolio/__tests__/value-series.test.ts
- src/lib/portfolio/__tests__/investor-nav-snapshot.test.ts
- src/lib/inngest/functions/__tests__/investor-nav-snapshot-hourly.test.ts
- src/lib/portfolio/geometry/__tests__/value-series-projection.test.ts

---

## RELEASED LOCKS

### feat/projection-preview-editable-inputs
Owner: Opus Orchestrateur — Projection Preview Editable Inputs
Branch: feat/projection-preview-editable-inputs
Merged PR: #111 (merge d8975ac6)
Released: 2026-06-26
Status: merged

Result:
- Made the read-only /admin/projection/preview input editable, bounded and safe — draft-only, no
  storage, no mutation; engine + API untouched. client.ts additive/pure: ProjectionPreviewDraft +
  DEFAULT_PREVIEW_DRAFT + PREVIEW_BOUNDS; validatePreviewDraft (local, runs BEFORE any API call —
  rejects non-number/NaN/Infinity/scientific-notation, capital out of 0–1e9, APY out of 0–100, APY
  min>max, horizon non-integer or out of 1–120, seed not 3–64 [A-Za-z0-9_-]; per-field messages, no
  value on failure); buildPreviewInput(value,mode) maps validated values to the API input preserving
  the non-editable fixture (product/currency/70-30 allocation/assumptions) — v0 no methodology, v2
  adds methodology with the validated seed (iterations 2000 fixed). Wrapper: editable Capital/APY min/
  APY max/Horizon (+ v2 Seed) fields, inline+summary errors, invalid blocks the run (no API call),
  Run/Reset, posture badges (Preview input·No storage·Read-only·Range only), allocation fixture note,
  edit-after-success → stale ribbon, Reset → default draft + idle. Scoped CSS (input grid 5→2→1
  responsive, field/error/reset/stale; token-only var(--ct-*), graphite, single green accent, 4px,
  no overflow). Tests: validatePreviewDraft (valid coercion + all invalid cases incl. min>max /
  NaN-Infinity-1e9 / prompt-like seed) + buildPreviewInput (v0/v2 mapping, fixture preserved) +
  wrapper idle render (prefilled fields, seed hidden in v0, posture badges, allocation note, no
  JSON/forbidden leak). Docs: PRODUCT_PROJECTION_SWARM.md editable-inputs section. Verified live
  (:4115, dev-bypass admin): APY min>max → field+summary error, NO API call (idle, no report); valid
  edits flow through (Target APY 6–12%, Capital 2000000 USDC); v2 seed editable → p5/p50/p95 change
  with seed (seed-aaa 6.62/9/11.4 vs seed-bbb 6.51/9.02/11.35); stale ribbon after edit; Reset
  restores defaults+idle; overflow 0; no forbidden words, no NaN/Inf, no JSON leak (only console noise
  = pre-existing third-party Privy auth, unrelated). typecheck PASS, build PASS (postgresql), 63
  projection UI/client tests pass. No Prisma/migration, no engine/API rewrite, no write/external-tool/
  storage, no proof-center/portfolio/vault change, no nav change. Did NOT touch src/components/** owned
  by other agents nor studio.tsx/page.tsx. Next lot (one): share the percentile band visual into the
  Scenario Lab (/admin/scenario-lab), or add optional editable allocation weights (still read-only/draft).

### feat/projection-preview-methodology-v2
Owner: Opus Orchestrateur — Projection Preview Methodology v2 Rendering
Branch: feat/projection-preview-methodology-v2
Merged PR: #109 (merge 09857c99)
Released: 2026-06-26
Status: merged

Result:
- Rendered the existing Methodology v2 distribution (seeded p5/p50/p95) in the read-only
  /admin/projection/preview surface — UI-only, consuming artifact.methodology + .distribution
  verbatim (UI computes nothing). client.ts additive: PREVIEW_PROJECTION_INPUT_V2 (same labelled
  fixture + methodology {version:"v2", seed:"preview-hyv-v2", iterations:2000, confidenceBands:true})
  + PREVIEW_PROJECTION_SEED_V2 — no engine/types/API change. Wrapper: Deterministic v0 / Methodology
  v2 toggle (switch resets to idle), fixed seed visible in toolbar, mode-aware idle copy. View: on
  version v2, a Methodology v2 section — seed/iterations/model badges, p5/p50/p95 cards (APY% +
  projected yield, p50 captioned "Median scenario"), a median-not-a-target note, a CSS-only
  percentile band from distribution.bands (per-month p5→p95 band + p50 marker + axis + legend, no
  chart lib/SVG, finite-guarded so no NaN/Infinity renders), backend limitations; missing-distribution
  → "no distribution available" fallback (never fabricated). Generic Charts block still filters
  percentile_band. Scoped CSS additive (toggle + v2 section + band; token-only var(--ct-*), graphite
  panels, single green accent, 4px grid, responsive, overflow 0). Copy reworded to avoid forbidden
  tokens (no guarantee/certain/promise anywhere). Tests: v2 render (section/seed/p5-p50-p95/band/
  median framing/no-NaN-Inf/no-JSON-leak/missing-distribution fallback) + v0 unchanged + client v2
  input shape. Docs: PRODUCT_PROJECTION_SWARM.md v2 rendering section. Verified live (:4114, dev-bypass
  admin): v0 → version v0, no v2 section, overflow 0; v2 → seed preview-hyv-v2, iterations 2000,
  p5/p50/p95 8.64/11.41/14.54% monotonic + yields, 12-month band + legend + p50 marker, median note,
  3 limitations, no forbidden words, no NaN/Inf, no JSON leak, overflow 0 (only console noise =
  pre-existing third-party Privy auth 403+CSP+iframe, unrelated). typecheck PASS, build PASS
  (postgresql), 48 projection UI/client tests pass. No Prisma/migration, no engine/API rewrite, no
  write/external-tool/execution, no proof-center/portfolio/vault change. Did NOT touch src/components/**
  owned by other agents nor studio.tsx/page.tsx/actions.ts. Next lot (one): editable bounded preview
  inputs + a v2 seed selector (still read-only), or share the percentile band visual into Scenario Lab.

### feat/projection-artifact-ui-wiring
Owner: Opus Orchestrateur — Projection Artifact UI Wiring
Branch: feat/projection-artifact-ui-wiring
Merged PR: #107 (merge 2bf8099e)
Released: 2026-06-26
Status: merged

Result:
- Rendered the existing read-only Product Projection artifact (product_projection_swarm →
  POST /api/admin/agentic/projection) in a new admin Strategy surface — UI-only wiring, no
  engine change. New route /admin/projection/preview + additive "Projection Preview" Strategy
  sub-nav tab (existing /admin/projection Projection Studio left fully intact). client.ts
  runProjectionPreview() (single on-demand POST, no mutation/storage/auto-poll; 200→artifact,
  400→invalid, 500/network→generic; never leaks a raw payload/stack; PREVIEW_PROJECTION_INPUT
  is an explicit, badged "Preview input" fixture, not "live"). Pure projection-report-view:
  hero + Read-only/No-side-effects badges, metric cards (Capital base · Target APY range ·
  Projected yield range · Horizon), Bear/Base/Bull scenarios, CSS-only charts (range band /
  allocation mix / scenario compare, "missing input" note when absent — never a fake chart),
  Assumptions/Risks/Provenance/Missing inputs/Disclaimers. APY range only; no guaranteed
  return; no raw prompt/user text; v2 percentile_band intentionally NOT rendered. Client
  wrapper: idle/loading/success/invalid/error states. Scoped CSS projection-preview.css
  (token-only var(--ct-*), graphite-opaque DS panels, single green accent, 4px grid,
  responsive). Tests (pure view: all blocks/APY-range/no-forbidden-words/no-leak/missingInputs/
  no-v2 + client state mapping 200/400/500/network/malformed + nav). Docs: PRODUCT_PROJECTION_
  SWARM.md UI section. Verified live (:4113, dev-bypass admin): route 200; Run renders artifact
  — APY 8–15% range, Bear/Base/Bull, all blocks, 3 disclaimers; overflow 0px; no forbidden
  words; no JSON leak (2 console errors = pre-existing third-party Privy auth 403+CSP,
  unrelated). typecheck PASS, build PASS (postgresql), 51 projection-UI/client/nav tests pass.
  No Prisma/migration, no backend rewrite (client helper added only), no write action, no
  external tool, no execution, no proof-center/portfolio/vault change. Did NOT touch
  src/components/** owned by other agents, nor studio.tsx/page.tsx/actions.ts. Next lot (one):
  render the Methodology v2 distribution (distribution.bands + a p5/p50/p95 percentile_band
  band visual) read-only in this same surface, with a v2 toggle on the preview input.

### feat/projection-methodology-v2
Owner: Opus Orchestrateur — Projection Methodology v2
Branch: feat/projection-methodology-v2
Merged PR: #105 (merge fe02c6c7)
Released: 2026-06-26
Status: merged

Result:
- Added seeded p5/p50/p95 methodology v2 to the read-only product projection — additive/non-breaking
  (omit methodology → v0 unchanged). Pure & deterministic, REUSES the existing seeded PRNG
  (src/lib/engine/prng.ts, untouched) — no Math.random/Date.now, no new dependency. New
  product-projection/projection-methodology-v2.ts buildProjectionDistribution
  (seeded_scenario_distribution: truncated-normal APY samples clamped to the PROVIDED apyRange,
  projected yield = capitalBase×apy×horizon/12, linear-interp p5/p50/p95 + per-month bands ≤24pts;
  seed explicit string→FNV-1a / number, or derived:<hash> from inputs; iterations clamped [100,10000];
  null when apyRange absent — never fabricated). types: additive ProjectionMethodologyInput on input;
  ProjectionMethodology/Percentile/Distribution; artifact gains optional methodology+distribution,
  version "v0"|"v2", chart union += percentile_band. build-projection-artifact attaches them on
  version:"v2" (absent apyRange → missingInputs methodology_v2(needs apyRange), stays v0).
  validate-projection-input allowlists methodology (version v1|v2, seed, iterations, confidenceBands;
  invalid → 400). projection-guards v2 checks: seed present, iterations bounded, p5≤p50≤p95, no
  NaN/Inf, limitations present. API POST /api/admin/agentic/projection additive (no route change).
  Tests: engine (determinism-by-seed, ordering, clamp, no NaN/Inf, null-on-missing, derived seed) +
  artifact (v0 unchanged, v2 adds methodology/distribution/chart, guard catches tampered ordering) +
  API (v2 200 deterministic, invalid 400). Docs: PROJECTION_METHODOLOGY_V2.md + PRODUCT_PROJECTION_
  SWARM.md note. Verified live (:4112): v0 no distribution; v2+seed → p5/p50/p95 8.52/11.45/14.31%
  ordered in [8,15], p50 yield 114500 USDC, 12 bands, percentile_band chart, 3 limitations, no NaN/Inf;
  same seed → IDENTICAL; invalid → 400; no prompt leak. typecheck PASS, build PASS (postgresql), 588
  agentic tests pass (2 pre-existing reporting-crew DB tests rouge = env client-provider mismatch).
  src/lib/engine untouched (reuse only). No UI/DS, no migration, no execution, no external tool, no
  financial guarantee, APY range/distribution only. Did NOT touch src/components/** (another agent's
  UI). Next lot (enhancement, not a gap): market-calibrated v2 via the mining/BTC Monte-Carlo engine,
  or a read-only UI lot (Scenario Lab / projection panel) rendering distribution.bands.

### feat/product-projection-swarm
Owner: Opus Orchestrateur — Product Projection Swarm
Branch: feat/product-projection-swarm
Merged PR: #103 (merge f1a8e024)
Released: 2026-06-26
Status: merged

Result:
- Built the read-only Product Projection Swarm (v0): run_projection action + projection_flow crew +
  product_projection_swarm + a pure deterministic projection engine (src/lib/agentic/
  product-projection/**). validate-projection-input (allowlist, drops prompts/unknown fields);
  build-projection-artifact (deterministic, no Date/random; metrics target_apy[range]/capital_base/
  projected_yield[derived capitalBase×apyRange×horizon, simple non-compounded]; bear/base/bull
  scenarios framing the SAME provided range — invents nothing; structured charts not HTML;
  missingInputs for absent apy/capital/allocation/horizon); projection-guards (forbidden words /
  single-point-APY / mandatory disclaimers+provenance — disclaimers worded to avoid the banned tokens).
  product_projection_swarm mode simulation; scope navigate/run_projection/explain_risk/
  explain_provenance/explain_yield; forbids deploy/mark_live/send/source. Catalog 24→25 (11 read), crews
  6→7, swarms 5→6. POST /api/admin/agentic/projection (admin-gated, no-store, rate-limit+body-size,
  validates, runs guards before emit, returns artifact sideEffects/businessSideEffects false; 400
  invalid, 500 generic-no-leak). NOTE: endpoint is /projection not /projection/build because "build" is
  gitignored. Tests (engine determinism/missingInputs/APY-range/no-invented-numbers/guards, crew, swarm
  scope, action, API) + counter updates (read 10→11, total 24→25, crews 6→7, swarms 5→6) + docs
  (PRODUCT_PROJECTION_SWARM.md, SWARM_CALIBRATION.md). Verified live (:4111): full input → ranges +
  bear/base/bull + 3 disclaimers + missingInputs:[allocation], no forbidden words; thin input → all
  missing, nothing fabricated; invalid → 400; run_projection allow / draft_outreach out-of-scope;
  registry = 6 swarms/25 actions/7 crews. typecheck PASS, build PASS (postgresql), 533 agentic tests
  pass (2 pre-existing reporting-crew DB tests rouge = env client-provider mismatch). No UI/DS, no
  migration, no execution, no external tool, no financial guarantee, APY range only. Did NOT touch
  src/components/** (another agent's UI). The agentic read/observe/projection surface is now complete;
  next enhancement (not a gap): Monte-Carlo p5/p50/p95 via the Scenario Engine under Methodology v2,
  or a read-only UI lot rendering the artifact (Scenario Lab / projection panel).

### feat/agentic-utility-read-actions
Owner: Opus Orchestrateur — Agentic Utility Read Actions
Branch: feat/agentic-utility-read-actions
Merged PR: #101 (merge ef325143)
Released: 2026-06-26
Status: merged

Result:
- Added 3 read_only catalog actions so the two weak swarms have genuinely useful enforced scopes
  (no write, no execution, no external tool, no Prisma, no prompt/user-text, no new swarm).
  explain_risk (LP risk-profile explanation, output-guarded), explain_provenance (metric
  provenance/attestation), read_session_context (metadata-only session view — ids/counts/timestamps,
  NEVER raw user text/prompts). Scopes widened: lp_explainer += explain_risk/explain_provenance →
  fully enforce + useful (4 LP explanations); memory_maintenance += read_session_context → enforce
  minimal useful (real differentiated read action, no persistence). Catalog 21 → 24 (10 read / 5
  draft / 1 confirmed_write / 8 forbidden). Verified live (:4110): new actions allow/read_only_allowed
  in their swarm, out-of-scope in a wrong swarm → action_out_of_swarm_scope, registry exposes 24
  actions. Tests: per-swarm scope + "utility actions well-formed"; updated EXPECTED_READ_ONLY_IDS +
  system-map matrix counts (7→10 read, 21→24 total). typecheck PASS, build PASS (postgresql), 515
  agentic tests pass (2 pre-existing reporting-crew DB tests rouge = env client-provider mismatch).
  No UI/DS, no /admin/agentic visual, no migration, no product_projection_swarm. Did NOT touch
  src/components/** (another agent's UI). Next lot: build product_projection_swarm — add a read_only
  run_projection action backed by the seeded pure engine (output-guarded) + a projection_flow crew,
  then the swarm (projection is read_only by ADR-006; no gated/confirmed_write machinery needed).

### feat/swarm-scope-enforcement-all
Owner: Opus Orchestrateur — Swarm Scope Enforcement All
Branch: feat/swarm-scope-enforcement-all
Merged PR: #99 (merge bd820926)
Released: 2026-06-26
Status: merged

Result:
- Extended the enforced allowedActionIds boundary to the 4 remaining swarms — all 5 now have a
  load-bearing scope (none decorative). Registry-only change + tests/docs; no new actions, no new
  swarm, no execution. Scopes (catalog ids, assertSwarmSafe-validated): platform_reporting
  (navigate_admin_surface/compose_reporting_briefing/read_observability/review_router_quality/
  inspect_tool_boundary; forbids send-run+source); lp_explainer (navigate_admin_surface/
  explain_product/explain_yield; forbids send-run+source); vault_governance (navigate_admin_surface/
  read_observability/create_review_note_draft/create_governance_proposal_draft/create_vault_draft →
  drafts gated; forbids deploy_product+mark_vault_live[also floored]+send-run); memory_maintenance
  (theoretical-but-bounded: navigate_admin_surface/read_observability only — no memory catalog action
  exists yet; forbids send-run+source). outreach_governed unchanged (regression-guarded). Behaviour:
  in-scope read→allow, draft→gated, out-of-scope→action_out_of_swarm_scope, swarm-forbidden→
  forbidden_by_swarm, forbidden_autonomous→forbidden_autonomous (floor); no swarm loosens the floor.
  New swarm-scope-all.test.ts (per-swarm + global "no swarm unbounded"/"floor holds"/"ids∈catalog");
  updated boundary+route tests (no unscoped path remains); calibrate-swarms.mjs derives the
  out-of-scope probe from the registry. SWARM_CALIBRATION.md: per-swarm scope table + verdict
  (fully-enforce: outreach/vault_governance/platform_reporting; enforce-but-weak: lp_explainer;
  theoretical-but-bounded: memory_maintenance). Verified live (:4109): all 5 swarms in-scope reachable,
  out-of-scope blocked, forbidden effective — CALIBRATION OK. typecheck PASS, build PASS (postgresql),
  514 agentic tests pass. Non-breaking endpoints, no autonomous_write/execution/external-tool/Prisma/
  migration/UI-DS, no product_projection_swarm. Did NOT touch src/components/** (another agent's UI).
  Next lot: add read-only explain_risk/explain_provenance + a memory read action to graduate
  lp_explainer/memory_maintenance from weak/theoretical (still no projection swarm).

### feat/swarm-boundary-enforcement
Owner: Opus Orchestrateur — Swarm Boundary Enforcement
Branch: feat/swarm-boundary-enforcement
Merged PR: #97 (merge d4f66296)
Released: 2026-06-26
Status: merged

Result:
- Made the swarm boundary enforcing in evaluateActionReadiness (was decorative metadata).
  Swarm-aware evaluator, tightens-only: forbidden_autonomous (floor) → forbidden_by_swarm (action in
  swarm.forbiddenActions, even WITH token) → action_out_of_swarm_scope (allowedActionIds set & action
  not in it) → tier decision. New optional SwarmDefinition.allowedActionIds (catalog-validated by
  assertSwarmSafe → allowed_action_not_in_catalog); evaluation gains swarmScoped:boolean;
  SwarmSimulationError gains reasonCode. outreach_governed_swarm is the FIRST enforcing swarm
  (draft-only scope: navigate_admin_surface/explain_product/explain_yield/draft_outreach_email/
  create_campaign_draft; forbids send-run + lead-sourcing + tier-A); other 4 stay tier-only
  (backward-compatible). Reason codes: + forbidden_by_swarm, action_out_of_swarm_scope,
  swarm_not_registered, crew_unavailable; split crew_mode_blocked → crew_blocked_forbidden/
  crew_blocked_missing_confirmation; renamed confirmed_write_token_present →
  human_confirmation_token_present; kept unknown_tier_blocked as fail-closed guard. simulate route
  threads simulation.swarm + surfaces error reasonCode; registry snapshot exposes allowedActionIds.
  New swarm-boundary-enforcement.test.ts; calibration net + calibrate-swarms.mjs made scope-aware.
  Verified live (:4108): in-scope reachable, read_observability → action_out_of_swarm_scope,
  outreach_trigger_send_run+token → forbidden_by_swarm, deploy_product+token → forbidden_autonomous,
  unknown swarm → swarm_not_registered, confirmed_write+token (unscoped) → human_confirmation_token_present.
  typecheck PASS, build PASS (postgresql), 539 agentic tests pass (2 pre-existing reporting-crew DB
  tests rouge = env client-provider mismatch). Endpoints non-breaking (sideEffects/businessSideEffects
  false, no raw payload, unknown swarm 404). No autonomous_write, no real execution, no external tool,
  no Prisma/migration, no UI/DS. Did NOT touch src/components/** (another agent's UI). Next lot: extend
  enforced allowedActionIds scopes to the other 4 swarms (vault_governance/lp_explainer/
  platform_reporting/memory_maintenance) to graduate them from theoretical/weak.

### chore/swarm-calibration
Owner: Opus Orchestrateur — Swarm Calibration
Branch: chore/swarm-calibration
Merged PR: #95 (merge 1272a025)
Released: 2026-06-26
Status: merged

Result:
- Read-only/simulation-only calibration campaign of the agentic swarm chain (registry → simulate →
  observability → aggregates), run live. All safety invariants PASS: 5 swarms, modes ∈ {simulation,
  dry_run, gated}, none autonomous_write; forbidden blocked even with token; confirmed_write gated
  without token; unknown action blocked fail-safe; unknown swarm → 404; sideEffects/businessSideEffects
  false; no prompt/user-text/raw leak; observability opt-in metadata-only; aggregates clamp/window/leak
  correct. Structural weakness identified: readiness is swarm-independent (swarm.forbiddenActions is
  decorative). Adversarial multi-agent verdict: outreach_governed + platform_reporting = weak;
  vault_governance/lp_explainer/memory_maintenance = theoretical; product_projection_swarm = build AFTER
  (no projection action/crew; projection is read_only by ADR-006) — confirmed ABSENT. Deliverables:
  pure safety-net test src/lib/agentic/__tests__/swarm-calibration.test.ts (13 tests, fails if a swarm
  becomes unsafe), live runner scripts/agentic/calibrate-swarms.mjs (opt-in --record), docs/agentic/
  SWARM_CALIBRATION.md (matrix + verdict + first-improvement + projection decision). typecheck PASS,
  build PASS (postgresql), 520 agentic tests pass (2 pre-existing reporting-crew DB tests rouge = env
  client-provider mismatch). Did NOT touch src/components/** (another agent's UI), no migration.
  Next backend lot: make the swarm boundary enforcing (thread swarm into evaluateActionReadiness:
  tier ∩ swarm allowlist + action_out_of_swarm_scope code), starting with outreach_governed_swarm.

### chore/agentic-backend-audit
Owner: Opus Orchestrateur — Agentic Backend Audit
Branch: chore/agentic-backend-audit
Merged PR: #92 (merge 92ceafff)
Released: 2026-06-26
Status: merged

Result:
- Audited the agentic backend surface (registry/simulate/simulations/aggregates routes + swarm/
  observability libs): clean on auth gating, fail-safe input validation, error-leak (generic
  responses, no stack/secret), purity/determinism, no `any`/as-unknown, no-store, guarded Redis
  parse. One finding: the 3 GET read endpoints were admin-gated but not rate-limited (POST simulate
  is; repo review-mode GET rate-limits reads). Fix: per-admin read rate limiting (60/min → 429) on
  registry/simulations/aggregates GET; captures userId from requireAdmin + assertRateLimit. Tests
  mock @/lib/rate-limit + new registry 429 case (84/84). Doc note added. No business/contract/
  response-shape change. Did NOT touch src/components/admin/agentic/** (another agent's active UI
  work). typecheck PASS, build PASS (postgresql). No UI/DS/proof-center/portfolio/vault/Prisma change.

### feat/agentic-simulation-aggregates
Owner: Opus Orchestrateur — Agentic Simulation Aggregates API
Branch: feat/agentic-simulation-aggregates
Merged PR: #90 (merge 184d3126)
Released: 2026-06-26
Status: merged

Result:
- Added GET /api/admin/agentic/simulations/aggregates — read-only, metadata-only roll-up over
  the existing Redis-capped + in-memory simulation trace store (NO DB, NO migration, NO mutation).
  New pure src/lib/agentic/observability/simulation-aggregates.ts:
  aggregateAgenticSimulationTraces(traces, {window?, nowMs?, topReasonCodesLimit?}) — deterministic
  (window cutoff injected, reads no clock), rolls up totals + bySwarm + byMode + byReadinessOutcome
  + topReasonCodes (sorted count desc/key asc, codes capped 10), copies only allowlisted numeric/id/
  code fields → emits no raw trace body / no free text. parseSimulationWindow validates 1h|24h|7d|all.
  Endpoint admin-only, no-store, limit clamped [1,200], window default all; imports the specific obs
  modules (not the router barrel) to avoid the Prisma chain; store unavailable → safe 200
  {available:false, reason:"store_unavailable", aggregates:<empty>}, never a stack/secret; 400 on
  invalid limit/window. 28 tests (45/45 agentic api+obs total). docs/agentic/
  AGENTIC_SIMULATION_OBSERVABILITY.md updated. typecheck PASS, my files lint clean, build PASS
  (postgresql). Runtime smoke (:4106, real Redis): available:true metadataOnly:true, limit/window
  applied, clamp 200, no id/createdAt/prompt leaked. No UI/DS/admin-agentic-visual/proof-center/
  portfolio/vault change. Next lot: a Control Tower UI view consuming registry/simulate/simulations/
  aggregates read-only (separate UI lot) — the backend agentic read/observe surface is now complete.

### feat/agentic-simulation-observability
Owner: Opus Orchestrateur — Agentic Simulation Observability
Branch: feat/agentic-simulation-observability
Merged PR: #88 (merge bf4a2498)
Released: 2026-06-26
Status: merged

Result:
- Added opt-in, append-only, metadata-only observability for agentic swarm simulations —
  NO Prisma migration, NO durable DB write (Redis capped list agentic:simulation:traces cap
  200 + 7d TTL, in-memory mirror), NO business mutation, NO prompt/user-text/payload/secret,
  NO external tool; a store failure never affects the simulation. simulation-store.ts (best-
  effort Redis+memory), simulation-trace.ts (AgenticSimulationTrace metadata-only;
  buildSimulationTrace allowlist-only — no payload smuggling; recordAgenticSimulationTrace
  opt-in fail-safe: disabled→reason:"disabled" via AGENTIC_SIMULATION_OBSERVABILITY=0,
  store_error→recorded:false, else recorded:true+storage). POST /api/admin/agentic/simulate
  gained observability:{record?} opt-in (default records nothing; read-only contract preserved)
  + response observability:{requested,recorded,reason?,storage?} + businessSideEffects:false;
  unknown swarm → 404 before any record. New GET /api/admin/agentic/simulations (admin-only,
  no-store, metadata-only, limit clamped [1,200]). Routes import the specific obs modules (not
  the router barrel) to avoid the Prisma chain. 30 tests. docs/agentic/
  AGENTIC_SIMULATION_OBSERVABILITY.md. typecheck PASS, build PASS (postgresql). Runtime smoke
  (:4106, real Redis): no-opt-in→recorded:false; opt-in→recorded:true storage:redis;
  forbidden→blocked+recorded; unknown→404 no record; GET→metadata-only keys. No UI/DS/admin-
  agentic-visual/proof-center/portfolio/vault change, no migration. Next lot: simulation-trace
  aggregates (counts by swarm/outcome over a window) read endpoint, or a UI history view (UI lot).

### feat/agentic-readonly-api
Owner: Opus Orchestrateur — Agentic Read-only API
Branch: feat/agentic-readonly-api
Merged PR: #86 (merge dc62708f)
Released: 2026-06-26
Status: merged

Result:
- Exposed the agentic swarm foundation via two admin-gated, read-only/simulation-only routes.
  GET /api/admin/agentic/registry → deterministic snapshot (22 agents, 6 crews, 5 swarms,
  action policies, safety metadata: allowedSwarmModes/disallowed[autonomous_write]/
  simulationOnly/noExternalTools/noDbWrites/noPromptOrUserTextStored); requireAdmin → 401/403;
  no-store; NO DB query. New pure serializer src/lib/agentic/swarm/registry-snapshot.ts.
  POST /api/admin/agentic/simulate → allowlisted {swarmId, actionId?, context?}, runs pure
  simulateSwarm + evaluateActionReadiness, returns rollup with sideEffects:false; 400 invalid,
  404 unknown swarm (no fallback), 429 rate-limited, 500 generic (no stack/secret). forbidden
  stays blocked even with a token; confirmed_write→requires_human_confirmation without token;
  unknown write-like blocked. 46 tests (route + snapshot) + docs/agentic/AGENTIC_READONLY_API.md.
  typecheck PASS, build PASS (postgresql). Runtime smoke (postgres :4106): registry 200, simulate
  valid 200, unknown 404, forbidden→blocked, confirmed_write→requires_human_confirmation — all
  sideEffects:false. No UI/DS/admin-agentic-visual/proof-center/portfolio/vault change, no Prisma
  migration, no DB write, no external tool, no new dependency. Next lot: a UI lot surfacing the
  swarm layer in the Control Tower (consuming these endpoints read-only) — separate, UI-scoped.

### feat/agentic-backend-foundation
Owner: Opus Orchestrateur — Agentic Backend / Swarm / Crew Foundation
Branch: feat/agentic-backend-foundation
Merged PR: #84 (merge 40e24a37)
Released: 2026-06-26
Status: merged

Result:
- Added a pure, deterministic, read-only SWARM layer (src/lib/agentic/swarm/**) composing
  the 6 existing crew simulations — no new agents invented, no real numbers changed, no UI,
  no API, no DB. types.ts: SwarmExecutionMode union {simulation|dry_run|gated} makes an
  autonomous-write swarm unrepresentable; AgenticAuditEvent carries ids + machine reason codes
  only (no prompt/user text). registry.ts: 5 swarms (platform_reporting, lp_explainer,
  vault_governance[dry_run], outreach_governed[gated], memory_maintenance[dry_run]).
  simulate-swarm.ts: simulateSwarm(id) deterministic (no Date/random), aggregates blocked
  actions/gates/confirmations, emits a pure audit trail; unknown swarm/crew → typed error, no
  fallback. readiness.ts: evaluateActionReadiness reuses ACTION_READINESS_ITEMS + fail-safe
  classifier — read_only→allow, draft→gated, confirmed_write→requires_human_confirmation
  (→allow only with explicit token, never autonomous), forbidden→blocked even with token,
  unknown write-like→blocked. safety.ts: per-swarm invariants. 26 swarm tests + 107 existing
  crew/action tests green. docs/agentic/BACKEND_AGENTIC_FOUNDATION.md. typecheck PASS, lint 0,
  build PASS (postgresql). All forbidden paths (admin/agentic, proof-center, portfolio, vault,
  schema, migrations) untouched. Next lot: read-only API surface (/api/admin/agentic/registry
  + /simulate) OR a UI topology node for swarms (separate UI lot).

### fix/prisma-worktree-isolation
Owner: Opus Orchestrateur — Prisma Worktree Isolation
Branch: fix/prisma-worktree-isolation
Merged PR: #82 (merge 2a49e369)
Released: 2026-06-26
Status: merged

Result:
- Closed the worktree clobber hazard: pnpm dedups dependencies so every worktree's
  @prisma/client symlinks into one shared .pnpm store dir, and a sqlite `prisma generate`
  from a test/dev hook overwrote the postgres client a live `pnpm dev` server depended on
  (broke the live server twice during the perf lots). New scripts/assert-prisma-provider-safe.mjs:
  postgres generate always allowed; a sqlite generate is REFUSED (exit 1, clear message) while a
  dev server listens on :4105, unless CI / PRISMA_SQLITE_ISOLATED=1. Wired into `pretest` →
  `pnpm test` now fails fast BEFORE any clobber. New `test:sqlite:isolated` for the override path;
  vitest include extended to scripts/**/*.test.mjs; 12 pure-helper tests. docs/dev/
  PRISMA_WORKTREE_ISOLATION.md documents safe/forbidden commands + recovery + agent rule.
  Verified live with the main postgres server on :4105: guard refused sqlite, `pnpm test` aborted
  at pretest, shared client stayed postgresql, server stayed up. typecheck PASS, lint 0 errors,
  build PASS (postgresql). Infra only — no app/UI/DS/router/guard/HITL/Prisma-model/migration change.
  Next lot: per-worktree generated client output (structural isolation so sqlite + postgres
  clients never collide), which would let tests + a dev server coexist without the guard refusing.

### fix/client-network-perf
Owner: Opus Orchestrateur — Client Network Performance Fix
Branch: fix/client-network-perf
Merged PR: #79 (merge fcb247f3)
Released: 2026-06-26
Status: merged

Result:
- Closed the two client-network regressions the qa:perf-network guardrail had been
  failing on (the #74 dedup only collapsed concurrent in-flight requests; idle polling
  + an unconditional probe still breached the targets). chat-nav-bridge.tsx: `armed`
  gate → exactly ONE /api/chat-nav poll on mount, backoff chain only (re)arms on a real
  signal (cockpit:chat-sent / visibilitychange / consumed directive); post-message nav
  unchanged; new pure shouldScheduleNextPoll(kind, armed). chat-presets.tsx:
  GET /api/admin/review-mode probe route-gated via usePathname → runs only under /admin,
  defaults to the LP set on the LP cockpit (zero requireAdmin round-trip on /portfolio);
  new pure shouldProbeAdminRole(pathname). Verified live (postgres, full 450-node render,
  twice): chat-nav 3→1 PASS, review-mode 1→0 PASS, qa:perf-network green. typecheck PASS,
  lint 0 errors, build PASS (postgresql), targeted pure-helper tests PASS (chat-nav-bridge +
  new chat-presets). All forbidden paths untouched. NO UI/UX, DS, /admin/agentic, portfolio
  visual, router/guard/HITL, API-contract, or Prisma/schema change.

### feat/perf-network-guardrails
Owner: Opus Orchestrateur — Performance Guardrails
Branch: feat/perf-network-guardrails
Merged PR: #75 (merge d7fbb0e6)
Released: 2026-06-26
Status: merged

Result:
- Network request guardrails (non-UI): new scripts/perf/qa-network-guardrails.mjs loads
  /portfolio in headless chromium, counts API calls per endpoint, and fails (exit 1) when
  /api/chat-nav exceeds 1 call on initial load OR /api/admin/review-mode fires on a non-admin
  route. Reports TTFB/FCP/DOMContentLoaded/long-tasks/DOM-nodes as INFO. Never fabricates a
  pass: server-down / login-blocked / chromium-missing → exit 2 (could-not-run). package.json
  gained `qa:perf-network`. docs/performance/NETWORK_GUARDRAILS.md documents problem, thresholds,
  run steps, fail interpretation, and non-scope. Verified live against dev: guardrail correctly
  FAILED current main (chat-nav 3>1, review-mode 1>0) — the app fix is owned by another agent.
  typecheck PASS, lint 0 errors, build PASS (postgresql), empty Prisma diff, all forbidden paths
  (/admin/agentic, portfolio components, chat-nav/review-mode routes, schema, migrations) untouched.

### feat/agentic-control-tower-v2
Owner: Opus Orchestrateur — Agentic Control Tower Redesign V2
Branch: feat/agentic-control-tower-v2
Merged PR: #72 (merge c752d59e)
Released: 2026-06-26
Status: merged

Result:
- Agentic Control Tower V2: full UX/UI redesign of /admin/agentic from a 552-line
  documentation wall of 32 equivalent cards into a navigable, hierarchical control tower.
  New components: agentic-control-tower.tsx (orchestrator), agentic-command-summary.tsx
  (hero: health + 5 headline metrics + attention + "nothing executes"), agentic-section-nav.tsx
  (sticky 7-anchor internal nav), agentic-topology-map.tsx (8 CSS-grid blocks: router centre,
  guards/HITL/tool-boundary around, observability above, agents+actions outward, forbidden zone),
  agentic-capabilities-board.tsx (4-lane: autonomous/draft/confirmed/never in product language),
  agentic-agents-overview.tsx (22 agents grouped by domain), agentic-safety-boundary.tsx (4-pillar
  safety grid). tower-summary.ts (pure buildTowerSummary for hero numbers + health). Removed old
  agentic-system-map.tsx + agentic-detail-inspector.tsx (replaced by topology). admin-docs.css
  gained a full token-only V2 tower grammar. page.tsx reduced from 552 to 75 lines. 3484/3484
  tests, typecheck PASS, lint 0, build PASS (postgresql), empty Prisma diff, hardcode scan clean.
  Playwright E2E fail = pre-existing login-flow:91 (non-blocking). Vercel READY.

### feat/agentic-visual-integration-v1
Owner: Opus Orchestrateur Continu — Agentic Visual Console Integration V1
Branch: feat/agentic-visual-integration-v1
Merged PR: #70 (merge 6b941d18)
Released: 2026-06-26
Status: merged

Result:
- Agentic Visual Console Integration V1: wired the Action Readiness Matrix + Crew
  Simulation Read-Only modules into the visual /admin/agentic. System map gained two
  layer groups (Action Readiness + Crew Simulation): action nodes (action-readiness +
  read-only/draft/confirmed-write/forbidden-actions, live counts 7/5/1/8) and crew-sim
  nodes (crew-simulation + 6 flow nodes, executable:false), plus the required edges
  (tool-boundary→readiness→tiers, hitl/guard gates, sim→flows, flow→observability/
  quality/tool-boundary/forbidden). system-map/index.ts getActionReadinessMatrix() +
  getCrewSimulations() (pure) feed the map. New UI: action-readiness-matrix-section.tsx
  (#action-readiness, tier count cards + 4 visual tier lanes) + crew-simulation-section.tsx
  (#crew-simulation, 6 flow cards with numbered step rails, gates, blocked actions,
  prominent executable:false — NO Run/Execute/Launch/Send/Deploy control). Detail inspector
  gained a Readiness & simulation rollup + jump-links. admin-docs.css token-only lane/flow
  styles (no hex). action-readiness/crew-simulation modules consumed READ-ONLY (not edited).
  NO CrewAI, NO autonomous runtime, NO tool execution, NO write tools, NO router/guard/HITL/
  chat change, NO Prisma/schema change, NO migration, NO user text/prompt/tool payload.
  typecheck PASS, lint 0, full suite 3498/3498, build PASS (postgresql), empty Prisma diff.
  Merged 6b941d18, PR #70. Vercel prod READY; prod /admin/agentic 307→/login.

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
