export const meta = {
  name: 'ds-conformance',
  description: 'Audit every page/route-section against the Hearst Connect design system (canon = /admin/design-system + docs/DS_CONFORMANCE_PROMPT.md). Read-only by default; opt-in worktree --fix.',
  whenToUse: 'Verify all pages are "wired to the DS": tokens-only, approved primitives, surface/nesting rules, product-honesty. Portfolio is the canon seed — audited read-only, never fixed.',
  phases: [
    { title: 'Audit', detail: 'one DS-auditor per route-section, parallel, structured findings' },
    { title: 'Synthesize', detail: 'aggregate scores + write docs/audit/ds-conformance-<date>.md' },
    { title: 'Fix', detail: 'opt-in (args.fix): worktree-isolated token-only fixes, never portfolio' },
  ],
}

// ── Route scopes ────────────────────────────────────────────────────────────
// reference:true  → audited READ-ONLY (canon seed), never --fixed.
const DEFAULT_SCOPES = [
  { key: '/portfolio', reference: true, globs: 'src/app/(product)/portfolio/** src/components/portfolio/**' },
  { key: '/vaults (invest flow)', globs: 'src/app/(product)/vaults/** src/components/vaults/** src/components/connect/**' },
  { key: '/proof-center', globs: 'src/app/(product)/proof-center/** src/components/proof-center/**' },
  { key: '/profile', globs: 'src/app/(product)/profile/** src/components/profile/**' },
  { key: 'auth + funnel (login/apply/onboarding/legal)', globs: 'src/app/(product)/onboarding/** src/app/login/** src/app/apply/** src/app/legal/** src/components/onboarding/** src/components/apply/**' },
  { key: '/admin/dashboard + CRM', globs: 'src/app/admin/dashboard/** src/app/admin/customers/** src/app/admin/agents/** src/app/admin/feedback/** src/components/admin/dashboard/** src/components/admin/customer/**' },
  { key: '/admin strategy (workspace/scenario/projection)', globs: 'src/app/admin/product-workspace/** src/app/admin/scenario-lab/** src/app/admin/projection/** src/components/admin/product-workspace/**' },
  { key: '/admin vaults (vaults/distributions/signals)', globs: 'src/app/admin/vaults/** src/app/admin/distributions/** src/app/admin/signals/**' },
  { key: '/admin proof & system', globs: 'src/app/admin/proof-center/** src/app/admin/proofs/** src/app/admin/monitoring/** src/app/admin/security/** src/app/admin/governance/** src/components/admin/governance/** src/components/admin/monitoring/**' },
  { key: '/admin operations (roadmap/spec/memo/audit + /admin root)', globs: 'src/app/admin/roadmap/** src/app/admin/spec/** src/app/admin/investor-memo/** src/app/admin/audit/** src/app/admin/page.tsx' },
  { key: '/admin outreach', globs: 'src/app/admin/outreach/** src/components/admin/outreach/**' },
  { key: 'admin agent-canvas', globs: 'src/app/admin/agent-canvas/** src/components/admin/agent-canvas/**' },
  { key: 'shared shell + nav + cockpit primitives', globs: 'src/components/nav/** src/components/admin/cockpit/** src/app/admin/layout.tsx src/app/cockpit.css' },
]

const scopes = (args && Array.isArray(args.scopes) && args.scopes.length ? args.scopes : DEFAULT_SCOPES)
const doFix = !!(args && args.fix)

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: { type: 'string' },
    score: { type: 'number' },
    isReference: { type: 'boolean' },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          dimension: { type: 'string' },
          file: { type: 'string' },
          location: { type: 'string' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'dimension', 'file', 'location', 'issue', 'fix'],
      },
    },
  },
  required: ['scope', 'score', 'isReference', 'summary', 'findings'],
}

const CANON = `
You are a DESIGN-SYSTEM CONFORMANCE auditor for Hearst Connect (Next.js 16, Tailwind v4, Cockpit tokens).

FIRST, read the authoritative checklist + scoring rubric + exceptions:
  docs/DS_CONFORMANCE_PROMPT.md
and skim the living reference it points to:
  src/app/admin/design-system/  (the rendered DS reference page)
  src/components/ui/*           (the approved primitives — real signatures)

Then audit ONLY the files in your assigned scope (glob + read them). Grade the 9
dimensions (D1 tokens-only, D2 one-green, D3 dark-only, D4 primitives-reused,
D5 surfaces/nesting, D6 typography-roles, D7 spacing/radius, D8 product-honesty,
D9 page-shell/states). For EACH violation give severity + dimension + file:line +
a TOKEN-ONLY / primitive-swap fix. Compute the page score per the rubric
(start 100; P0 −20, P1 −8, P2 −3; floor 0; pass = ≥90 and zero P0).

Static code audit only (token/primitive/honesty/surface drift). Live responsive
overflow is out of scope here — that is /visual-review's job; do NOT spin up a browser.

Respect the "Do NOT flag" list in the checklist exactly (the /admin/design-system
Section F cage demo, primitive-internal shadows, cockpit-tokens.ts, dashboard
ambient light, unwired-but-built components). Do NOT invent findings to fill a quota
— a clean scope returns an empty findings array and a high score.
`

phase('Audit')
const results = (await parallel(
  scopes.map((s) => () =>
    agent(
      `${CANON}\n\nYOUR SCOPE: ${s.key}\nFILES (glob these): ${s.globs}\n` +
      (s.reference
        ? `\nThis scope is the CANON SEED (reference). Audit it READ-ONLY for token purity awareness, set isReference=true, and do NOT report .pf-* / portfolio-local patterns as "re-implemented primitive". Convergence flows toward this page.`
        : `\nSet isReference=false.`),
      { label: `audit:${s.key}`, phase: 'Audit', schema: FINDINGS_SCHEMA, agentType: 'general-purpose' },
    ),
  ),
)).filter(Boolean)

const allFindings = results.flatMap((r) => (r.findings || []).map((f) => ({ ...f, scope: r.scope })))
const p0 = allFindings.filter((f) => f.severity === 'P0').length
const p1 = allFindings.filter((f) => f.severity === 'P1').length
const p2 = allFindings.filter((f) => f.severity === 'P2').length
const graded = results.filter((r) => !r.isReference)
const meanScore = graded.length ? Math.round(graded.reduce((a, r) => a + (r.score || 0), 0) / graded.length) : 100
log(`Audited ${results.length} scopes — mean score ${meanScore}/100 · P0:${p0} P1:${p1} P2:${p2}`)

phase('Synthesize')
const report = await agent(
  `You are the SYNTHESIS step of a design-system conformance audit. Below is the JSON array of per-scope results.\n` +
  `Write a prioritized markdown report and SAVE it to docs/audit/ds-conformance-<YYYY-MM-DD>.md (get the date with \`date +%F\` via Bash, create docs/audit/ if missing).\n` +
  `Report structure:\n` +
  `  1. Header: date, global mean score (graded scopes only — exclude isReference), totals P0/P1/P2, pass/fail (pass = mean ≥90 AND zero P0).\n` +
  `  2. Scoreboard table: scope | score | P0 | P1 | P2 | status (✅≥90 / ⚠️70-89 / ❌<70 / 🌱reference).\n` +
  `  3. P0 section (must-fix), then P1, then P2 — grouped, each: scope · dimension · file:line · issue → token-only fix.\n` +
  `  4. "Portfolio (reference seed)" note: read-only, never fixed; convergence flows toward it.\n` +
  `  5. Next actions: the smallest set of fixes that would move the most pages to ≥90.\n` +
  `Do NOT edit any source file. Do NOT git commit. Return the saved report path + a 5-line executive summary.\n\n` +
  `RESULTS JSON:\n${JSON.stringify(results, null, 1)}`,
  { label: 'synthesize:report', phase: 'Synthesize', agentType: 'general-purpose' },
)

let fixSummary = null
if (doFix) {
  phase('Fix')
  const fixable = results.filter(
    (r) => !r.isReference && (r.findings || []).some((f) => f.severity === 'P0' || f.severity === 'P1'),
  )
  log(`--fix on: applying token-only fixes for ${fixable.length} scopes (worktree-isolated, portfolio excluded)`)
  const fixes = (await parallel(
    fixable.map((r) => () =>
      agent(
        `You are a surgical DESIGN-SYSTEM fixer. First read docs/DS_CONFORMANCE_PROMPT.md (the guardrails + "Do NOT flag" exceptions).\n` +
        `Apply ONLY token-only / primitive-swap corrections for the P0 + P1 findings below, in your scope's files. Rules: no new token/colour/glow/\`dark:\`; reuse existing primitives; max two surface levels; NEVER touch portfolio, the frozen zero-state, or the /admin/design-system Section F demo. No behaviour change. No git add/commit/push.\n` +
        `After editing run \`pnpm typecheck\` and \`npx eslint <your edited files>\` and fix any breakage you introduce.\n` +
        `Return a concise changelog: findings applied, findings skipped (+why), final typecheck/eslint status.\n\n` +
        `SCOPE: ${r.scope}\nFINDINGS:\n${JSON.stringify((r.findings || []).filter((f) => f.severity !== 'P2'), null, 1)}`,
        { label: `fix:${r.scope}`, phase: 'Fix', isolation: 'worktree', agentType: 'general-purpose' },
      ),
    ),
  )).filter(Boolean)
  fixSummary = fixes
}

return {
  scopesAudited: results.length,
  meanScore,
  totals: { P0: p0, P1: p1, P2: p2 },
  pass: meanScore >= 90 && p0 === 0,
  perScope: results.map((r) => ({ scope: r.scope, score: r.score, reference: r.isReference, findings: (r.findings || []).length })),
  report,
  fixApplied: doFix,
  fixSummary,
}
