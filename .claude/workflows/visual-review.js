export const meta = {
  name: 'visual-review',
  description: 'Exhaustive multi-agent visual review of the Cockpit UI: screenshot sweep × viewports × chat-state, DS-aware critics per axis, adversarial verify, worktree-isolated fixes, HTML report',
  whenToUse: 'When you want a deep, parallel visual QA of Hearst Connect screens (portfolio/vaults/proof/admin) at all viewports with chat open AND closed — finds layout/token/typo/overflow breaks and fixes them in isolated worktrees for review.',
  phases: [
    { title: 'Sweep',    detail: 'Playwright screenshots + DOM metrics per route × viewport × chat-state' },
    { title: 'Critique', detail: 'One DS-aware critic per axis (layout, tokens, typo, overflow, a11y)' },
    { title: 'Verify',   detail: 'Adversarial 3-vote verification of each finding (kill false positives)' },
    { title: 'Fix',      detail: 'Worktree-isolated fix per confirmed finding (ui-dev)' },
    { title: 'Report',   detail: 'Synthesize prioritized HTML report with before/after captures' },
  ],
}

// ── Config ────────────────────────────────────────────────────────────────────
// Routes default to the authenticated Cockpit surfaces. Override via args:
//   Workflow({ name: 'visual-review', args: { routes: ['/portfolio','/vaults'], base: 'http://localhost:4105' } })
const BASE = (args && args.base) || 'http://localhost:4105'
const ROUTES = (args && args.routes) || [
  '/portfolio', '/vaults', '/proof-center',
  '/admin/dashboard', '/admin/proof-center', '/admin/customers', '/admin/governance',
]
// 6 viewports the project cares about (laptop chat-open is the known stress case).
const VIEWPORTS = [
  { w: 1600, h: 900 }, { w: 1440, h: 900 }, { w: 1280, h: 800 },
  { w: 1024, h: 768 }, { w: 768, h: 844 }, { w: 390, h: 844 },
]
// DS-aware critic axes. Each is blind to the others (multi-modal sweep).
const AXES = [
  { key: 'layout',   prompt: 'rails/center/page-area geometry, side-by-side vs stacked reflow, fit-gate clipping, footer pinning' },
  { key: 'overflow', prompt: 'horizontal scroll, vertical clipping, text overflowing its box, ellipsis missing, content cut below fold' },
  { key: 'tokens',   prompt: 'colors/spacing/radius NOT from --ct-* tokens, the single green #A7FB90 rule, no raw hex, no magic px' },
  { key: 'typo',     prompt: 'font-size out of the --ct-text-* scale, illegible micro text, vertical/compressed text, line-height collisions' },
  { key: 'a11y',     prompt: 'contrast on dark shell, focus rings, disabled fake-CTAs, missing aria, dead placeholder buttons' },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'route', 'viewport', 'selector', 'severity', 'evidence', 'fix'],
        properties: {
          title:    { type: 'string' },
          route:    { type: 'string' },
          viewport: { type: 'string' },
          selector: { type: 'string', description: 'CSS selector of the broken element' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          evidence: { type: 'string', description: 'concrete measured value, e.g. "trio scrollH 145 > clientH 104"' },
          fix:      { type: 'string', description: 'the precise CSS/TSX change to make' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['isReal', 'reason'],
  properties: {
    isReal: { type: 'boolean' },
    reason: { type: 'string' },
  },
}

const FIX_SCHEMA = {
  type: 'object',
  required: ['applied', 'files', 'summary'],
  properties: {
    applied: { type: 'boolean' },
    files:   { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

// ── Phase 1: Sweep (one agent per route, each measures all viewports × chat-state) ──
phase('Sweep')
log(`Sweeping ${ROUTES.length} routes × ${VIEWPORTS.length} viewports × {chat open, closed} on ${BASE}`)

const sweeps = await parallel(ROUTES.map((route) => () =>
  agent(
    `You are a visual-QA agent with Playwright MCP. Navigate ${BASE}${route}.
For EACH viewport in ${JSON.stringify(VIEWPORTS)} AND for chat-open AND chat-closed
(toggle the last button in .ct-rail-right-header .ct-rail-right-btn), measure with
browser_evaluate: window.innerWidth, documentElement.scrollWidth (hScroll = scrollWidth>innerWidth),
.ct-rail-left/.ct-rail-right/.ct-center-panel/#main-content widths, and for any panel
whether scrollHeight>clientHeight (vertical clip) or text overflows its box. Take one
screenshot per (viewport, chat-state). Return a compact JSON summary of every measured
state and any anomaly (hScroll true, clipped panel, vertical text, overflow).
Return raw data only.`,
    { label: `sweep:${route}`, phase: 'Sweep', agentType: 'general-purpose' }
  ).then((data) => ({ route, data }))
))
const sweepResults = sweeps.filter(Boolean)
log(`Sweep done: ${sweepResults.length}/${ROUTES.length} routes captured`)

// ── Phases 2-3: Critique → Verify, pipelined per axis (no barrier) ──
phase('Critique')
const sweepDigest = sweepResults
  .map((s) => `### ${s.route}\n${typeof s.data === 'string' ? s.data : JSON.stringify(s.data)}`)
  .join('\n\n')

const reviewed = await pipeline(
  AXES,
  // Stage 1: one DS-aware critic per axis, reading the whole sweep
  (axis) => agent(
    `You are a Hearst Connect DS critic for the "${axis.key}" axis: ${axis.prompt}.
The design system is LOCKED: --ct-* tokens only, a single green #A7FB90, dark mode only,
Cockpit shell (rails + center + chat). Read this screenshot/metrics sweep and report ONLY
real "${axis.key}" defects with concrete evidence and a precise fix. Do not invent.

SWEEP:
${sweepDigest}`,
    { label: `critic:${axis.key}`, phase: 'Critique', schema: FINDINGS_SCHEMA }
  ),
  // Stage 2: adversarial 3-vote verify of each finding (kills false positives)
  (review, axis) => parallel((review.findings || []).map((f) => () =>
    parallel([0, 1, 2].map((v) => () =>
      agent(
        `Adversarially REFUTE this ${axis.key} finding. Default to isReal:false if uncertain.
Finding: ${f.title} | route ${f.route} | viewport ${f.viewport} | selector ${f.selector}
| evidence: ${f.evidence}. Is this a REAL visual defect in the locked Cockpit DS, or a
false positive / intended behavior (e.g. PORTFOLIO_ZERO_CONTRACT freezes the zero-state DOM)?`,
        { label: `verify:${axis.key}:${f.severity}`, phase: 'Verify', schema: VERDICT_SCHEMA }
      )
    )).then((votes) => {
      const real = votes.filter(Boolean).filter((v) => v.isReal).length >= 2
      return { ...f, axis: axis.key, confirmed: real }
    })
  ))
)

const confirmed = reviewed.flat().filter(Boolean).filter((f) => f.confirmed)
log(`Critique+verify done: ${confirmed.length} confirmed findings (P0=${confirmed.filter(f=>f.severity==='P0').length})`)

if (confirmed.length === 0) {
  return { verdict: 'clean', routes: ROUTES, viewports: VIEWPORTS, findings: [] }
}

// ── Phase 4: Fix each confirmed finding in an isolated worktree (ui-dev) ──
phase('Fix')
const fixes = await parallel(confirmed.map((f) => () =>
  agent(
    `You are ui-dev for Hearst Connect. Apply the MINIMAL fix for this confirmed defect.
HARD RULES: only --ct-* tokens, single green #A7FB90, no cross-project imports, never edit
the frozen portfolio zero-state DOM (see docs/PORTFOLIO_ZERO_CONTRACT.md). Surgical change only.
Do NOT git add/commit/push — leave the change in the working tree for review.

Finding: ${f.title}
Route: ${f.route} | Viewport: ${f.viewport} | Severity: ${f.severity}
Selector: ${f.selector}
Evidence: ${f.evidence}
Proposed fix: ${f.fix}`,
    { label: `fix:${f.axis}:${f.severity}`, phase: 'Fix', schema: FIX_SCHEMA, isolation: 'worktree', agentType: 'ui-dev' }
  ).then((r) => ({ finding: f, result: r }))
))
const applied = fixes.filter(Boolean).filter((x) => x.result && x.result.applied)
log(`Fixes applied in worktrees: ${applied.length}/${confirmed.length}`)

// ── Phase 5: Synthesize the report ──
phase('Report')
const report = await agent(
  `Synthesize a prioritized visual-review report (markdown) for Hearst Connect.
Group confirmed findings by severity (P0/P1/P2) then by route. For each: title, route,
viewport, selector, evidence, the fix applied, and which worktree files changed. End with
a "Remaining / not fixed" section for any finding whose fix did not apply.

CONFIRMED FINDINGS:
${JSON.stringify(confirmed, null, 2)}

FIX RESULTS:
${JSON.stringify(fixes.filter(Boolean).map((x) => ({ title: x.finding.title, ...x.result })), null, 2)}`,
  { label: 'report', phase: 'Report' }
)

return {
  verdict: confirmed.some((f) => f.severity === 'P0') ? 'P0-found' : 'issues-found',
  confirmedCount: confirmed.length,
  appliedCount: applied.length,
  report,
}
