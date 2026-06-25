export const meta = {
  name: 'ds-conformance',
  description: 'Inventory every UI surface, then audit each against the Hearst Connect design system (canon = /admin/design-system + docs/DS_CONFORMANCE_PROMPT.md). Read-only by default; opt-in worktree --fix per scope only.',
  whenToUse: 'Verify EVERY real UI surface (pages, layouts, modules, modals/drawers/popovers, loading/error/empty states, primitives) is "wired to the DS": tokens-only, approved primitives, surface/nesting rules, product-honesty. Phase 0 builds an exhaustive surface inventory first so nothing escapes the audit. Portfolio is the canon seed — audited read-only, never fixed.',
  phases: [
    { title: 'Inventory', detail: 'Phase 0 — enumerate routes/modules/overlays/states/primitives → docs/audit/ds-surface-inventory-<date>.md' },
    { title: 'Audit', detail: 'one DS-auditor per route-section (scope map from inventory), parallel, structured findings + coverage' },
    { title: 'Verify', detail: 'adversarial re-check of P0/P1 findings before they are reported' },
    { title: 'Synthesize', detail: 'aggregate scores + coverage + write docs/audit/ds-conformance-<date>.md' },
    { title: 'Fix', detail: 'opt-in (args.fix) — per-scope only, worktree-isolated, token-only, never portfolio / Section F' },
  ],
}

// ── Args / defaults ─────────────────────────────────────────────────────────
const a = args || {}
const readOnly = a.readOnly !== false                 // default true
const doFix = a.fix === true                          // default false
const inventoryOnly = a.inventoryOnly === true        // stop after Phase 0
const includeOverlays = a.includeOverlays !== false   // default true
const includeStates = a.includeStates !== false       // default true
const includePrimitives = a.includePrimitives !== false // default true
const failOnUncovered = a.failOnUncovered === true    // default false
const explicitScope = typeof a.scope === 'string' && a.scope.trim() ? a.scope.trim() : null

// ── Route scopes (recommended map; Phase 0 reports anything UNMAPPED) ────────
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
  { key: 'admin agent-canvas', globs: 'src/app/admin/agent-canvas/** src/components/admin/agent-canvas/** src/lib/canvas/**' },
  { key: '/admin/design-system (catalogue)', reference: true, globs: 'src/app/admin/design-system/**' },
  { key: 'shared shell + nav + cockpit primitives', globs: 'src/components/nav/** src/components/admin/cockpit/** src/app/admin/layout.tsx src/app/cockpit.css' },
  { key: 'global overlays + states (toasts/search/shortcuts/confirm/skeleton)', globs: 'src/components/ui/** src/components/search/** src/components/command/** src/components/overlays/**' },
]

// Scope selection: explicit single scope wins, else args.scopes, else defaults.
let scopes = DEFAULT_SCOPES
if (Array.isArray(a.scopes) && a.scopes.length) scopes = a.scopes
if (explicitScope) {
  scopes = [{ key: explicitScope, globs: explicitScope.includes('*') ? explicitScope : `${explicitScope}/** ${explicitScope}` }]
}

// ── FIX SAFETY GATE (runs BEFORE any agent) ──────────────────────────────────
// Global --fix is forbidden. Fix requires an explicit scope and never touches
// Portfolio or the /admin/design-system Section F anti-pattern demos.
if (doFix) {
  if (!explicitScope && !(Array.isArray(a.scopes) && a.scopes.length)) {
    log('❌ STOP — `fix:true` requires an explicit `scope` (or a narrowed `scopes` array). Global --fix is forbidden by default. Nothing modified.')
    return { error: 'fix-requires-explicit-scope', modified: false }
  }
  const targets = (explicitScope ? [explicitScope] : a.scopes.map((s) => s.key || '')).join(' ').toLowerCase()
  if (targets.includes('portfolio')) {
    log('❌ STOP — Portfolio is the canon seed and is NEVER auto-fixed (frozen zero-state). Nothing modified.')
    return { error: 'portfolio-never-fixed', modified: false }
  }
  if (targets.includes('design-system') || targets.includes('section f')) {
    log('❌ STOP — /admin/design-system Section F anti-pattern demos are intentional and NEVER auto-fixed. Nothing modified.')
    return { error: 'section-f-never-fixed', modified: false }
  }
}

// ── PHASE 0 — Surface Inventory ──────────────────────────────────────────────
phase('Inventory')
const INVENTORY_PROMPT = `
You are PHASE 0 of a design-system conformance audit: build an EXHAUSTIVE SURFACE INVENTORY
of every real UI surface in Hearst Connect, so that nothing (a page, layout, module, modal,
drawer, popover, loading/empty/error state, or shared component) escapes the audit.

Use Bash + Grep/Glob (NO browser, NO source edits, NO git mutations). Suggested discovery:
  - Routes:        \`find src/app -type f \\( -name 'page.tsx' -o -name 'layout.tsx' -o -name 'loading.tsx' -o -name 'error.tsx' -o -name 'not-found.tsx' -o -name 'template.tsx' \\)\`
  - Visible modules: list src/components/** (admin, portfolio, proof-center, scenario, nav, ui, …)
  - Overlays:      \`grep -rEl 'Dialog|Modal|Popover|Tooltip|Dropdown|Command|Sheet|Drawer|Toast|Confirm|AlertDialog|Menu|Overlay|Portal' src/components src/app\`
  - States:        \`grep -rEl 'EmptySurface|Skeleton|PanelStatus|loading\\.tsx|error\\.tsx|isLoading|isPending|empty' src/components src/app\` + hand-rolled empties/skeletons
  - Primitives:    list src/components/ui/*

Classify every surface and decide audit-target yes/no. Mark as EXCLUSIONS (audit target = no):
  - /portfolio (canon seed, read-only, never-fix)
  - /admin/design-system Section F (intentional anti-pattern demos, never-fix)
  - src/lib/pdf/pdf-palette.ts + src/lib/brand-constants.ts (raw-hex exception: PDF/Privy/email)
  - tests, generated files, node_modules, docs, screenshots/logs/temp, debug/dev pages
For each exclusion give: scope/file · reason · read-only(yes/no) · never-fix(yes/no).

A "coverage gap" = any file/surface that looks UI-related but does NOT map to one of the
recommended scopes below. List EVERY such file explicitly — this is the whole point of Phase 0.

RECOMMENDED SCOPE MAP (the scopes the audit will actually run):
${scopes.map((s) => `  - ${s.key}${s.reference ? '  [reference: read-only]' : ''}  ⇐  ${s.globs}`).join('\n')}

Write the inventory to docs/audit/ds-surface-inventory-<YYYY-MM-DD>.md (get the date via
\`date +%F\`; create docs/audit/ if missing). Structure EXACTLY:
  1. Summary — total app routes / page.tsx / layout.tsx / loading+error states / visible modules /
     overlays+modals+popups / primitives / audit targets / exclusions / suspected uncovered surfaces.
  2. Route inventory — table: route | file | type | scope | audit target | notes
  3. Module inventory — table: component | file | kind | used by | audit target | notes
  ${includeOverlays ? '4. Overlay inventory — table: surface | file | kind | trigger route/component | audit target | notes' : '4. Overlay inventory — SKIPPED (includeOverlays=false)'}
  ${includeStates ? '5. State inventory — table: state | file | kind | primitive/handrolled | audit target | notes' : '5. State inventory — SKIPPED (includeStates=false)'}
  ${includePrimitives ? '6. Primitive inventory — table: primitive | file | purpose | expected usage' : '6. Primitive inventory — SKIPPED (includePrimitives=false)'}
  7. Exclusions — table: scope/file | reason | read-only | never-fix
  8. Coverage gaps — list every UI-related file not mapped to a scope.
  9. Recommended scope map — the exact scopes /ds-conformance should audit (start from the map above; ADD a scope for any coverage gap you found).

Return STRICT JSON only (the document is your side-effect): the counts + the gap list + the recommended scope map.
`

const INVENTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reportPath: { type: 'string' },
    counts: {
      type: 'object',
      additionalProperties: true,
      properties: {
        appRoutes: { type: 'number' },
        pageTsx: { type: 'number' },
        layoutTsx: { type: 'number' },
        loadingErrorStates: { type: 'number' },
        visibleModules: { type: 'number' },
        overlays: { type: 'number' },
        primitives: { type: 'number' },
        auditTargets: { type: 'number' },
        exclusions: { type: 'number' },
        suspectedUncovered: { type: 'number' },
      },
      required: ['appRoutes', 'pageTsx', 'layoutTsx', 'visibleModules', 'overlays', 'primitives', 'auditTargets', 'exclusions', 'suspectedUncovered'],
    },
    coverageGaps: { type: 'array', items: { type: 'string' } },
    recommendedScopes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { key: { type: 'string' }, globs: { type: 'string' }, reference: { type: 'boolean' } },
        required: ['key', 'globs'],
      },
    },
  },
  required: ['reportPath', 'counts', 'coverageGaps', 'recommendedScopes'],
}

const inventory = await agent(INVENTORY_PROMPT, {
  label: 'inventory:surfaces',
  phase: 'Inventory',
  schema: INVENTORY_SCHEMA,
  agentType: 'general-purpose',
})

const gaps = (inventory && inventory.coverageGaps) || []
log(
  `Phase 0 inventory: ${inventory ? inventory.counts.appRoutes : '?'} routes · ` +
  `${inventory ? inventory.counts.visibleModules : '?'} modules · ` +
  `${inventory ? inventory.counts.overlays : '?'} overlays · ` +
  `${inventory ? inventory.counts.primitives : '?'} primitives · ` +
  `${gaps.length} coverage gap(s).`,
)
if (gaps.length) log(`⚠️ Coverage gaps (not mapped to a scope): ${gaps.slice(0, 20).join(', ')}${gaps.length > 20 ? ` … +${gaps.length - 20} more` : ''}`)

// Fold any inventory-recommended scopes the default map missed (so the audit covers gaps).
if (!explicitScope && inventory && Array.isArray(inventory.recommendedScopes)) {
  const known = new Set(scopes.map((s) => s.key))
  for (const rs of inventory.recommendedScopes) {
    if (rs && rs.key && rs.globs && !known.has(rs.key)) {
      scopes.push({ key: rs.key, globs: rs.globs, reference: !!rs.reference, fromGap: true })
      known.add(rs.key)
    }
  }
}

if (inventoryOnly) {
  log('inventoryOnly=true — stopping after Phase 0 (no conformance audit, no fix).')
  return {
    inventoryOnly: true,
    inventoryReport: inventory ? inventory.reportPath : null,
    counts: inventory ? inventory.counts : null,
    coverageGaps: gaps,
    scopesPlanned: scopes.map((s) => s.key),
  }
}

// ── Conformance audit schema ─────────────────────────────────────────────────
const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: { type: 'string' },
    score: { type: 'number' },
    isReference: { type: 'boolean' },
    summary: { type: 'string' },
    coverage: {
      type: 'object',
      additionalProperties: false,
      properties: {
        routesCovered: { type: 'array', items: { type: 'string' } },
        modulesCovered: { type: 'array', items: { type: 'string' } },
        overlaysCovered: { type: 'array', items: { type: 'string' } },
        statesCovered: { type: 'array', items: { type: 'string' } },
        uncovered: { type: 'array', items: { type: 'string' } },
      },
      required: ['routesCovered', 'modulesCovered', 'overlaysCovered', 'statesCovered', 'uncovered'],
    },
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
  required: ['scope', 'score', 'isReference', 'summary', 'coverage', 'findings'],
}

const CANON = `
You are a DESIGN-SYSTEM CONFORMANCE auditor for Hearst Connect (Next.js 16, Tailwind v4, Cockpit tokens).

FIRST, read the authoritative checklist + scoring rubric + exceptions:
  docs/DS_CONFORMANCE_PROMPT.md
and skim the living reference it points to:
  src/app/admin/design-system/  (the rendered DS reference page — a MIRROR, not the source)
  src/components/ui/*           (the approved primitives — the real signatures, the true source)

Then audit ONLY the files in your assigned scope (glob + read them). Grade the 9
dimensions (D1 tokens-only, D2 one-green, D3 dark-only, D4 primitives-reused,
D5 surfaces/nesting, D6 typography-roles, D7 spacing/radius, D8 product-honesty,
D9 page-shell/states). For EACH violation give severity + dimension + file:line +
a TOKEN-ONLY / primitive-swap fix. Compute the page score per the rubric
(start 100; P0 −20, P1 −8, P2 −3; floor 0; pass = ≥90 and zero P0).

COVERAGE (mandatory): your scope is not just "pages". Explicitly enumerate, in the
\`coverage\` object, WHICH routes / modules / overlays(modals,drawers,popovers,toasts) /
states(empty,loading,skeleton,error) inside your glob you actually inspected, and list
anything inside your glob you could NOT cover (uncovered[]). An overlay or an empty/loading
state inside your scope is a first-class audit target — do not skip it because it isn't a page.

Static code audit only (token/primitive/honesty/surface drift). Live responsive
overflow is out of scope here — that is /visual-review's job; do NOT spin up a browser.

Respect the "Do NOT flag" list in the checklist exactly (the /admin/design-system
Section F cage demo, primitive-internal shadows, pdf-palette.ts / brand-constants.ts, dashboard
ambient light, unwired-but-built components). Do NOT invent findings to fill a quota
— a clean scope returns an empty findings array and a high score.
`

phase('Audit')
const results = (await parallel(
  scopes.map((s) => () =>
    agent(
      `${CANON}\n\nYOUR SCOPE: ${s.key}\nFILES (glob these): ${s.globs}\n` +
      (s.reference
        ? `\nThis scope is a REFERENCE (canon seed / catalogue). Audit it READ-ONLY for token-purity awareness, set isReference=true, and do NOT report .pf-* / portfolio-local / Section-F-demo patterns as "re-implemented primitive". Convergence flows toward these.`
        : `\nSet isReference=false.`),
      { label: `audit:${s.key}`, phase: 'Audit', schema: FINDINGS_SCHEMA, agentType: 'general-purpose' },
    ),
  ),
)).filter(Boolean)

// ── Verify — adversarial re-check of P0/P1 before they are reported ──────────
phase('Verify')
const flagged = results.flatMap((r) =>
  (r.findings || [])
    .filter((f) => f.severity !== 'P2' && !r.isReference)
    .map((f) => ({ ...f, scope: r.scope })),
)
const verdicts = (await parallel(
  flagged.map((f) => () =>
    agent(
      `You adversarially VERIFY one design-system finding. Read docs/DS_CONFORMANCE_PROMPT.md (esp. the "Do NOT flag" exceptions), open the cited file, and decide if this is a REAL drift from the DS canon or a false positive (intentional exception, primitive-internal chrome, portfolio/.pf-* canon, Section F demo, pdf-palette.ts / brand-constants.ts, ambient dashboard light, unwired-but-built). Default to refuted=true if uncertain.\n\nFINDING:\n${JSON.stringify(f, null, 1)}`,
      {
        label: `verify:${f.file}`,
        phase: 'Verify',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { real: { type: 'boolean' }, refuted: { type: 'boolean' }, reason: { type: 'string' } },
          required: ['real', 'reason'],
        },
        agentType: 'general-purpose',
      },
    ).then((v) => ({ f, v })),
  ),
)).filter(Boolean)

const refutedKeys = new Set(
  verdicts.filter(({ v }) => v && (v.real === false || v.refuted === true)).map(({ f }) => `${f.scope}::${f.file}::${f.location}::${f.issue}`),
)
// Drop refuted P0/P1 from each scope + recompute scores.
for (const r of results) {
  if (r.isReference) continue
  const kept = (r.findings || []).filter((f) => !refutedKeys.has(`${r.scope}::${f.file}::${f.location}::${f.issue}`))
  r.findings = kept
  let score = 100
  for (const f of kept) score -= f.severity === 'P0' ? 20 : f.severity === 'P1' ? 8 : 3
  r.score = Math.max(0, score)
}
log(`Verify: ${flagged.length} P0/P1 findings checked, ${refutedKeys.size} refuted & dropped.`)

const allFindings = results.flatMap((r) => (r.findings || []).map((f) => ({ ...f, scope: r.scope })))
const p0 = allFindings.filter((f) => f.severity === 'P0').length
const p1 = allFindings.filter((f) => f.severity === 'P1').length
const p2 = allFindings.filter((f) => f.severity === 'P2').length
const graded = results.filter((r) => !r.isReference)
const meanScore = graded.length ? Math.round(graded.reduce((acc, r) => acc + (r.score || 0), 0) / graded.length) : 100
const allUncovered = results.flatMap((r) => (r.coverage && r.coverage.uncovered) || [])
log(`Audited ${results.length} scopes — mean score ${meanScore}/100 · P0:${p0} P1:${p1} P2:${p2} · uncovered:${allUncovered.length} · gaps:${gaps.length}`)

// ── Synthesize ───────────────────────────────────────────────────────────────
phase('Synthesize')
const report = await agent(
  `You are the SYNTHESIS step of a design-system conformance audit. Below is the JSON array of per-scope results (already adversarially verified) plus the Phase-0 inventory summary.\n` +
  `Write a prioritized markdown report and SAVE it to docs/audit/ds-conformance-<YYYY-MM-DD>.md (get the date with \`date +%F\` via Bash, create docs/audit/ if missing).\n` +
  `Report structure:\n` +
  `  1. Header: date, global mean score (graded scopes only — exclude isReference), totals P0/P1/P2, pass/fail (pass = mean ≥90 AND zero P0), and a link to the surface inventory (${inventory ? inventory.reportPath : 'docs/audit/ds-surface-inventory-<date>.md'}).\n` +
  `  2. Coverage summary: scopes audited, total surfaces inventoried (${inventory ? inventory.counts.auditTargets : '?'} audit targets), coverage gaps from Phase 0 (${gaps.length}), uncovered-inside-scope (${allUncovered.length}). List every uncovered surface + why.\n` +
  `  3. Scoreboard table: scope | score | P0 | P1 | P2 | routes/modules/overlays/states covered | status (✅≥90 / ⚠️70-89 / ❌<70 / 🌱reference).\n` +
  `  4. P0 section (must-fix), then P1, then P2 — grouped, each: scope · dimension · file:line · issue → token-only fix.\n` +
  `  5. "Portfolio + /admin/design-system (reference)" note: read-only, never fixed; convergence flows toward portfolio.\n` +
  `  6. Next actions: the smallest set of fixes that would move the most pages to ≥90, PLUS the scopes to add for any coverage gap.\n` +
  `Do NOT edit any source file. Do NOT git commit. Return the saved report path + a 5-line executive summary.\n\n` +
  `INVENTORY SUMMARY:\n${JSON.stringify(inventory || {}, null, 1)}\n\nRESULTS JSON:\n${JSON.stringify(results, null, 1)}`,
  { label: 'synthesize:report', phase: 'Synthesize', agentType: 'general-purpose' },
)

// ── Fix (opt-in, per-scope only, already gated above) ────────────────────────
let fixSummary = null
if (doFix) {
  phase('Fix')
  const fixable = results.filter(
    (r) => !r.isReference && (r.findings || []).some((f) => f.severity === 'P0' || f.severity === 'P1'),
  )
  log(`--fix on (explicit scope): applying token-only fixes for ${fixable.length} scope(s), worktree-isolated, portfolio/Section F excluded.`)
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

const uncoveredTotal = allUncovered.length + gaps.length
return {
  inventoryReport: inventory ? inventory.reportPath : null,
  inventoryCounts: inventory ? inventory.counts : null,
  coverageGaps: gaps,
  uncoveredInScope: allUncovered,
  scopesAudited: results.length,
  meanScore,
  totals: { P0: p0, P1: p1, P2: p2 },
  pass: meanScore >= 90 && p0 === 0 && (!failOnUncovered || uncoveredTotal === 0),
  failOnUncovered,
  uncoveredTotal,
  perScope: results.map((r) => ({ scope: r.scope, score: r.score, reference: r.isReference, findings: (r.findings || []).length, uncovered: ((r.coverage && r.coverage.uncovered) || []).length })),
  report,
  readOnly: readOnly && !doFix,
  fixApplied: doFix,
  fixSummary,
}
