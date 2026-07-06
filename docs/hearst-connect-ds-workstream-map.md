# Hearst Connect — DS Workstream Map (Visual Direction 2026)

Primitive matrix for the Nav / Portfolio / Vault / Invest redesign. **Tokenised ≠ DS canon** — a
page can use `var(--ct-*)` and still be off-DS if it re-creates its own cards/tables/badges/charts.
Consume these primitives; do not hand-roll.

## Layer authority (CI-locked — `ds-authority-lock.test.ts`)

- `src/components/catalyst/` — **canonical UI kit** (destination layer).
- `cockpit-shell/` — shell / rails / layout + `--ct-*` token base.
- `src/components/ui/` — **deprecated** (compat re-exports only).
- `src/components/dataviz/his/` — **HIS**, the canonical pure-SVG chart system.

## Primitive matrix

| Primitive | Path | State after #072 | Used by |
|---|---|---|---|
| **AccordionCard** | `catalyst/accordion.tsx` | **CREATED** — `.ct-glass-panel` surface, padded header + full-bleed body, grid-rows motion, `collapsible={false}` hero variant, `persistKey` | Vault Details |
| **StepTimeline** | `catalyst/step-timeline.tsx` | **CREATED** — vertical numbered spine, tones accent/warning/neutral | Capital Protection; explainers |
| **HcBarChart** | `dataviz/his/HcBarChart.tsx` | **CREATED** — rounded bars, `<title>` tooltip, `highlightLast`, honest empty | Yield bars (portfolio + vault) |
| **HcStackedBar** | `dataviz/his/HcStackedBar.tsx` | **CREATED** — horizontal proportion bar, `palette="categorical"` | Regime / scenario bars |
| **Categorical palette** | `src/app/cockpit.css` (`--ct-cat-*`) | **REINFORCED** — aliases of existing status tokens, no new hex | Donut, bars, allocation |
| **HcCompositionRing** | `dataviz/his/HcCompositionRing.tsx` | **REINFORCED** — added `palette` prop (accent \| categorical) | Allocation, strategy pockets |
| **BentoKpiStrip** | `catalyst/bento.tsx` | **REINFORCED** — added optional per-tile `caption` | Position Overview, Transactions KPIs |
| **HcValueChart / HcFanChart** | `dataviz/his/*` | REUSE | Position Overview hero, Invest time-to-target |
| **HcChartCard** | `dataviz/his/HcChartCard.tsx` | REUSE | every chart section |
| **Table** | `catalyst/table.tsx` | REUSE (gutter-frozen) | held index, transactions, infrastructure |
| **SegmentedControl** | `catalyst/segmented-control.tsx` | REUSE | vault / scenario filters |
| **EmptySurface** | `catalyst/empty-surface.tsx` | REUSE | held-vaults empty state |
| **CockpitButton** | `catalyst/cockpit-button.tsx` | REUSE | all CTAs, Withdraw outline |
| **BentoBadge / ProvenanceBadge** | `catalyst/*` / `ui/provenance-badge.tsx` | REUSE | LIVE / status / tx status |
| **WizardStepProgress / vaults/step-progress** | `catalyst/*` / `components/vaults/*` | REUSE | Invest 4-step |
| **ValueTrajectory / LockArc / CumulativeTargetBullet** | `components/portfolio/*` | REUSE (were orphaned, now mounted) | Position Overview hero |

## Files touched in #072

- Foundation: `src/app/cockpit.css` (+`--ct-cat-*`), `catalyst/{accordion,step-timeline}.tsx`,
  `dataviz/his/{HcBarChart,HcStackedBar,index}.tsx`, `dataviz/his/{geometry.ts,HcCompositionRing.tsx}`,
  `catalyst/bento.tsx`.
- Nav (A): `components/nav/{product-nav-items.ts,product-rail-intra.tsx}`,
  `app/(product)/my-vaults/page.tsx`.
- Vault (C): `app/(product)/portfolio/[positionId]/page.tsx`,
  `components/portfolio/position-strategy-allocation.tsx`.
- Invest (D): `components/vaults/vault-allocation-display.tsx`.
- Guard + tests: `lib/ds/__tests__/visual-direction-ds-contract.test.ts`,
  `ui/__tests__/accordion.test.tsx`, extended `dataviz/his/__tests__/his-primitives.test.tsx`;
  updated `nav/__tests__/product-rail-intra.test.tsx`, `lib/__tests__/product-routes.test.ts`.

## Open follow-ups

- `/my-vaults` is not yet a chat-nav destination (LP whitelist untouched to avoid the nav-corpus test
  minefield). Add a destination + intent when desired.
- Being on a Vault Details page (`/portfolio/[positionId]`) lights the **Portfolio** rail entry
  (it is a `/portfolio/*` URL). Cosmetic; revisit if a dedicated `/my-vaults/[id]` route is adopted.
- Workstream **B (Portfolio dashboard)** is the deferred next prompt.
