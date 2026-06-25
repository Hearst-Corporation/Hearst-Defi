# ADR-013 — Design-system canon: full glass everywhere, single recipe, unified doc-flow

**Status**: Accepted
**Date**: 2026-06-12
**Deciders**: Founder (Adrien) + Eng
**Supersedes**: the "flat admin" intent introduced in commits 313ca71 and 9ad2b53
**Relates to**: CLAUDE.md §"Méthode de travail visuel", `docs/DESIGN_SYSTEM.md`

## Context

Over the course of V1 development the design system accumulated competing surface
approaches that were never fully aligned:

1. **Six parallel container/panel systems** — `.glass-panel`, `.glass-panel-subtle`,
   `Card`, `.ct-glass-panel`, `.ct-system-panel`, and ad-hoc graphite-glass copies
   scattered across `cockpit.css` and individual page stylesheets. No single recipe
   was established as the default; each page author picked freely.

2. **Two layout files for document-flow** — `src/app/product-doc.css` and
   `src/app/admin-doc.css` introduced parallel stack/spacing primitives
   (`product-doc-stack*`, `admin-doc-stack*`, etc.) that were maintained in two
   places, causing drift.

3. **A half-finished "flat admin" refactor** (commits 313ca71 "flat vault list and
   extend DS strip across surfaces" and 9ad2b53 "responsive vault list and flat
   approvals table") introduced `.ct-system-panel` and borderless containers as the
   admin default. This intent was **not validated visually**, created an inconsistent
   split between product and admin aesthetics, and was subsequently reverted because
   it degraded the premium institutional feel throughout the operator console.

The net result was a codebase where every surface had to be audited individually to
determine which container tier applied, tests were written against the flat pattern
that no longer matched the product direction, and new contributors had no single
authoritative recipe to follow.

## Decision

### 1. Full glass everywhere — `.ct-glass-panel` is the canonical default

The premium smoked-glass surface (`.ct-glass-panel`) is the **DEFAULT container
recipe** for ALL surfaces across the product, including the admin/operator console.
No surface tier is "flat by default" for admin pages.

- `Card` MUST converge to render `.ct-glass-panel` as its base material.
- Every section container, panel, and module shell that currently uses
  `.ct-system-panel`, `.glass-panel`, `.glass-panel-subtle`, or an ad-hoc graphite
  inline style MUST be migrated to `.ct-glass-panel` (or a documented sub-variant
  thereof) in the migration lots described under **Consequences**.
- `.ct-system-panel` / the "flat" tier is **DEPRECATED**. It MUST NOT be used in
  new code. Existing usages are migration targets.
- The only supported exceptions to glass-as-default (already documented in
  `docs/DESIGN_SYSTEM.md` §Canon typo/layout) are: the dashboard command-board
  dense strip, the scenario-lab `scenario-preset-bar`, `Ptai variant="flat"`
  inside compare panels, and `EmptySurface` which stands alone with no surrounding
  box. These exceptions MUST be annotated with an inline comment referencing this ADR.
- Token constraints (non-negotiable, CI-enforced): accent = `--ct-accent` (#A7FB90)
  only; no raw hex in `.tsx`/`.ts` files (exceptions: `src/lib/pdf/pdf-palette.ts`,
  `src/lib/brand-constants.ts` for PDF/Privy/email); all surface values via `--ct-*`
  tokens from `cockpit.css`.

### 2. One canonical glass recipe — `.ct-glass-panel`

There MUST be exactly one glass material definition. `cockpit.css` is and remains
the single token source of truth for `--ct-*`.

- `.ct-glass-panel` is the canonical class, defined once in `cockpit.css`.
- The legacy aliases `.glass-panel` and `.glass-panel-subtle` are **DEPRECATED** and
  MUST be removed from `cockpit.css` once all call-sites are migrated.
- Graphite-glass copies duplicated across page-level stylesheets MUST be de-duplicated
  back to the canonical `cockpit.css` definition. No page stylesheet may redefine
  a glass material locally.
- `Card` in `src/components/ui/card.tsx` SHOULD be the primary JSX primitive for
  glass surfaces; direct class usage of `.ct-glass-panel` is permitted for non-JSX
  or layout-level wrappers.
- No second token namespace (`--ds-*` or any other) may be introduced. `@ds/core`
  has been removed and MUST NOT be reinstated.

### 3. One document-flow layout layer — `src/app/doc-flow.css`

The two parallel document-flow stylesheets `product-doc.css` and `admin-doc.css`
MUST be consolidated into a single file: `src/app/doc-flow.css`.

- Both scope classes (`.product-doc` and `.admin-doc`) are preserved inside
  `doc-flow.css`; no consumer rename is required at migration time.
- `src/app/doc-flow-typography.css` remains a shared typography companion to
  `doc-flow.css`, unchanged in scope or import order.
- After consolidation, `product-doc.css` and `admin-doc.css` MUST be deleted.
- `doc-flow.css` is imported from the app layout after `cockpit.css` and before
  `globals.css`; it MUST NOT define token values — only layout primitives.

## Consequences

### Positive
- **Single mental model**: every engineer and agent starts from `.ct-glass-panel` /
  `Card`; no more per-surface triage between six container systems.
- **Admin aesthetic consistency**: the operator console regains the same premium
  institutional glass feel as the LP-facing product surfaces.
- **Reduced CSS payload**: removing duplicate graphite-glass copies and the two
  parallel doc-flow files reduces the shipped CSS bundle.
- **Auditable exceptions**: all departures from glass-as-default are now
  explicitly documented (existing §Canon typo/layout list + this ADR).

### Negative / risks
- **Migration surface is large** — the flat refactor touched the vault list, the
  approvals table, and several proof/system pages. These must all be re-glassified
  in visual-validation lots before merging. Migration MUST be staged (one page or
  subsystem per lot) with a visual review gate between lots.
- **Test updates required** — any test that asserts the presence of `.ct-system-panel`,
  `.glass-panel-subtle`, or a flat container class must be updated to assert the
  new `.ct-glass-panel` canon. These are migration targets, not bugs to be silently
  deleted.
- **`doc-flow.css` consolidation is layout-preserving** — the stack/spacing
  primitives are merged, not redesigned; the visual output of every page using
  `.product-doc` or `.admin-doc` MUST be verified unchanged after consolidation.

### Migration lots (suggested order, each requires visual validation before merge)

1. **Lot 1 — `admin/vaults`**: vault list + vault detail approvals table → `.ct-glass-panel`.
2. **Lot 2 — Proof & System pages** (`/admin/proofs`, `/admin/monitoring`,
   `/admin/security`, `/admin/governance`): `SystemPanel` → `Card` (`.ct-glass-panel`).
3. **Lot 3 — `doc-flow.css` consolidation**: merge `product-doc.css` + `admin-doc.css`
   → `doc-flow.css`; delete originals; verify all `.product-doc` / `.admin-doc` pages.
4. **Lot 4 — cockpit.css cleanup**: remove `.glass-panel`, `.glass-panel-subtle`;
   consolidate graphite-glass copies; keep only `.ct-glass-panel`.

## Non-decisions (out of scope)
- **No change to the four structured agents** or any LLM/chat surface.
- **No new token values** introduced by this ADR; the glass recipe uses existing
  `--ct-graphite-*` and `--ct-surface-*` tokens already in `cockpit.css`.
- **No changes to the Scenario Lab viewport-locked surface** — its documented
  flat exceptions (`.scenario-preset-bar`, `Ptai variant="flat"`) are preserved.
- **No changes to `portfolio.css`** — the `pf-*` scoped layout is orthogonal to
  doc-flow and remains separate.

## References
- Commits being superseded: `313ca71` (flat vault list), `9ad2b53` (flat approvals).
- Token source: `src/app/cockpit.css` (canonical `--ct-*`).
- Canonical glass primitive: `src/components/ui/card.tsx` → `.ct-glass-panel`.
- Doc-flow destination: `src/app/doc-flow.css`.
- Typography companion: `src/app/doc-flow-typography.css`.
- Design system reference: `docs/DESIGN_SYSTEM.md`.
- **Living rendered reference**: `/admin/design-system` (wins over markdown wording).

## Terminology clarification (2026-06-25 — does not change the decision)

The ADR title and body use **« glass »** as a migration label for the unified container
class `.ct-glass-panel`. That name is **legacy**. The **live visual** (see
`src/app/cockpit.css` `.ct-glass-panel` rule and `/admin/design-system` §A Elevation)
is **opaque graphite / flat charcoal**:

- Fill: `--ct-graphite-subtle-bg` (solid, not translucent)
- `backdrop-filter: none` · no external drop shadow
- Depth from surface tiers + 1px border — not from frosted blur

When this ADR says « full glass everywhere », read: **one canonical opaque panel recipe
everywhere** (product + admin), replacing the deprecated admin-only flat tier
(`.ct-system-panel`). It does **not** mean smoked-glass, glassmorphism, or semi-translucent cards.

Raw-hex exceptions for non-CSS runtimes: `src/lib/pdf/pdf-palette.ts`,
`src/lib/brand-constants.ts` (not `cockpit-tokens.ts`, removed).
