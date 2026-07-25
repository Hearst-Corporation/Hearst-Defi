# HC-CHART-001 — Standardize all runtime charts on Recharts

Mission: **HC-CHART-001** · Issue **#409** · Type `CHART_SYSTEM_UPGRADE`
Base: `origin/main` @ `28404a2fe91b7af529bc7c68cc9d5f6f2547f598` (dispatch SHA)
Branch: `feat/chart-system-recharts`

**Recharts is now the single runtime chart engine.** The Hearst Instrument System
(pure-SVG `src/components/dataviz/his/**`) and Chart.js (`chart.js` /
`react-chartjs-2`) are removed. This is a chart-engine migration, **not** a
redesign — the calm, compact, dark-graphite visual language and `--ct-*` tokens,
the information hierarchy, labels/units/number formatting, provenance and honest
states are all preserved.

## Canonical chart layer (`src/components/catalyst/`)

| New | Purpose | Replaces |
|---|---|---|
| `chart.tsx` | shadcn-shaped Recharts wrapper (`ChartContainer`, tooltip, legend, `ChartConfig`) — tokenised | moved from `ui/chart.tsx` |
| `chart-scale.ts` | `valueYDomain` (framed, non-zero-baseline), `niceCeil`, `extent` | HIS `geometry.ts` |
| `chart-series.ts` | accent / categorical ramps + band/curve/grid tokens | HIS ramps |
| `chart-types.ts` | `ChartValuePoint` · `ChartLabeledValue` · `ChartSourceStatus` · `ChartPoint` | HIS `types.ts` |
| `chart-card.tsx` (`ChartCard`) | instrument card: header/metric/delta/source/disclaimer + honest states (ready/empty/loading/fallback/error/unavailable/not_configured/stale/partial) + hatch veil | `HcChartCard` |
| `chart-donut.tsx` (`ChartDonut`) | composition/allocation donut — `PieChart`/`Pie` + legend | `HcCompositionRing` |
| `chart-proportion-bar.tsx` (`ChartProportionBar`) | 100%-stacked horizontal proportion bar | `HcStackedBar` |
| `chart-value.tsx` (`ChartValue`) | value/NAV area+line, `valueYDomain` framing, dots ≤24 | `HcValueChart` |
| `chart-fan.tsx` (`ChartFan`) | projection fan (stacked-Area band + median line; `medianTone`/`bandTone`) | `HcFanChart`, honest-fan geometry |
| `chart-source-badge.tsx` (`ChartSourceBadge`) | provenance pill, verified/neutral/**nonprod-warning** tri-tone kept | `HcSourceBadge` |

`src/components/ui/chart.tsx` is now a **documented re-export shim only** (no
independent implementation). It is kept because `scripts/ds-convergence-guard.mjs`
allowlists `ui/chart.tsx` to live under `src/components/ui/`; the 7 existing
`@/components/ui/chart` import sites resolve through it to the Catalyst module.

## Old → new chart mapping (by consumer)

**Investor (Series 1, real product):**
- `vaults/page.tsx` — `HcCompositionRing` → `ChartDonut` (not-wired configured-target donut; kept "Configured policy split — not a live allocation" + the `state==='error'` blank panel).
- `series1-dashboard/Series1AllocationCockpit.tsx` — ring → `ChartDonut`.
- `series1-dashboard/Series1CapitalArchitecture.tsx` — `HcStackedBar` → `ChartProportionBar` (`AllocationBarRow`; `AllocationBarEmpty` honest-empty kept).
- `series1-dashboard/Series1DashboardHero.tsx` — ring → `ChartDonut` (mounted only when allocation present; empty baseline renders no chart).
- `features/investor-ui/components/reserve-cockpit/{block-frame,CapitalFlowRail}.tsx` — `HcSourceBadge`/`HcSourceStatus` → `ChartSourceBadge`/`ChartSourceStatus`.
- `lib/data/portfolio-dashboard.ts` — `HcValuePoint` (type) → `ChartValuePoint`.

**Admin:**
- `admin/strategies/collateral-timeline.tsx` — `HcChartCard` → `ChartCard` (raw ComposedChart untouched).
- `admin/strategies/strategy-workspace-client.tsx` — `HcChartCard` → `ChartCard`.
- `admin/strategies/strategy-studio-chart.tsx` — **bespoke pure-SVG engine → Recharts `ComposedChart`** (candidate lines + p5–p95 stacked-Area band + `ReferenceLine` thresholds); exported `StrategyStudioChart` API unchanged.
- `admin/product-workspace/monte-carlo-chart.tsx` — **Chart.js/`react-chartjs-2` → Recharts `LineChart`** (spaghetti + median); deterministic mulberry32 GBM + scalar-prop contract unchanged; runtime CSS-var-resolution machinery deleted (SVG reads tokens directly).

**Preview sandbox (admin-gated V4, mock data):**
- `portfolio/preview/page.tsx` — `HcValueChart` → `ChartValue`, `HcChartCard` → `ChartCard`.
- `portfolio/preview/_charts/honest-fan.tsx` — HIS geometry → thin wrapper over `ChartFan` (`medianTone="muted"`, `bandTone="graphite"` — median never accent green).
- `portfolio/preview/_data/mock.ts` — HIS types → `chart-types`.

**Other bespoke SVG engine on a real route:**
- `components/portfolio/value-trajectory.tsx` — **bespoke pure-SVG value/cone → Recharts `AreaChart`** (realized accent area + graphite projection cone via the stacked-Area band technique); exported API unchanged; `"use client"` added (Recharts is a client engine; the numeric `ValueProjection` serialises across the RSC boundary).

**Stories / tests / guard:**
- `HcStackedBar.stories.tsx` → renamed `ChartProportionBar.stories.tsx`.
- 4 Series 1 page stories retargeted from `data-hc-*` markers to Recharts `.recharts-*` selectors; a11y rule `scrollable-region-focusable` scoped off (Recharts `ResponsiveContainer`).
- HIS unit tests (`his-primitives.test`, `HcValueChart.test`) deleted with HIS; invariants re-expressed in `catalyst/__tests__/chart-layer.test.tsx` (framing, honest-empty, fallback veil, provenance tri-tone).
- `visual-direction-ds-contract.test.ts` — chart `SCOPE_FILES` repointed to the Catalyst chart files; `data-hc-empty` assertion → `data-chart-empty`.
- New guard `scripts/ds-chart-engine-guard.mjs` (`pnpm ds:guard:chart-engine`, chained into `pnpm ds:guard:all`) fails on any new import of `dataviz/his`, `chart.js`, or `react-chartjs-2`.

## Honest-state preservation (data honesty)

No fabricated data, no `0`-for-missing, no interpolation. Preserved verbatim:
absent monthly BTC accumulation → honest empty; strategies-not-wired → configured
target labelled "not a live allocation"; `state==='error'` → blank "couldn't reach
the data" panel; `CapitalFlowRail` null → `DataUnavailable`; honest-fan median stays
muted+dashed; preview page admin gate + green-pulse-only-for-Live; Monte-Carlo
"seeded · illustrative · not guaranteed". Every migrated chart renders **no chart at
all** (not an empty chart) when its series is absent.

## Documented visual deltas (implementation-driven, meaning-equivalent)

- **`strategy-studio-chart`**: the old `preserveAspectRatio="none"` non-uniform
  stretch cannot be reproduced by `ResponsiveContainer` — aspect ratio and x-tick
  density scale uniformly now. Scenario colours for safe/aggressive move from raw
  hex `SCENARIO_DOT` (`#60A5FA` / `#F7931A`) to `--ct-cat-*` tokens (mandated
  tokens-only; balanced `var(--ct-accent)` unchanged).
- **`value-trajectory`**: the now-endpoint marker is a plain accent `ReferenceDot`
  (the old CSS box-shadow glow isn't expressible on an SVG dot).
- **Monte-Carlo**: ~220 `<Line>` SVG series vs one Chart.js canvas — mitigated with
  `isAnimationActive={false}` and `dot={false}` throughout.

## Gate results (local)

| Gate | Result |
|---|---|
| `pnpm typecheck` | **PASS** (0 errors) |
| `pnpm lint` | **PASS** (12 pre-existing warnings, 0 errors, none chart-related) |
| `pnpm ds:guard` (hardcode) | **PASS** |
| `pnpm ds:guard:primitive` | **PASS** (0) |
| `pnpm ds:guard:chart-engine` (new) | **PASS** (0) |
| `pnpm ds:guard:convergence` | **96** hits — **pre-existing debt, zero new** (baseline was 96; none in chart files) |
| `pnpm test` | **3 failed / 4530 passed** — all 3 failures **pre-existing at origin/main** and unrelated to charts (see below); **0 new failures** |
| `pnpm storybook:build` | **PASS** (exit 0) |
| `pnpm build` | see final report |

**Pre-existing test failures (NOT introduced by this mission, verified against `origin/main`):**
1–2. `ds-authority-lock.test.ts` — reads `docs/CATALYST_CANON_REFERENCE.md` and
`docs/DS_SINGLE_SOURCE_OF_TRUTH.md`, both **absent at `origin/main`** (ENOENT).
3. `visual-direction-ds-contract.test.ts` "investor rail" — asserts nav ids
(`overview`/`vaults`/…) that `Series1Nav.tsx` does not contain (it uses
`dashboard`/`profile`/`proof`/`reserve`). Left untouched — fixing an unrelated
failing governance test to green a gate would be gaming it.

## Zero-import proof

`pnpm ds:guard:chart-engine` → `Hits: 0 · PASS`.
`grep -rEn "dataviz/his|chart\.js|react-chartjs-2" src` → only a documentation
comment in `catalyst/chart.tsx`; no imports. `src/components/dataviz/his/**`
deleted (15 files). `chart.js` + `react-chartjs-2` removed from `package.json` and
`pnpm-lock.yaml`.

## Known limitations / remaining non-Recharts SVG

- **Non-chart diagrams (out of the chart-engine rule, intentionally kept):**
  `portfolio/preview/_charts/agent-canvas.tsx` (node graph),
  `admin/design-system/section-patterns.tsx` (DS documentation illustration).
- **Preview-sandbox micro-viz** (`_charts/bullet`, `meter`, `production-bars`,
  `uptime-band`, `risk-dimensions`, `asset-ring`): local, admin-gated, mock-data
  bespoke components that never imported HIS/Chart.js. Out of the enumerated
  HIS/Chart.js scope; flagged for a follow-up if full Recharts coverage of the
  sandbox is desired.
- **Visual QA / screenshots:** before/after PNG capture requires driving a browser.
  Per the owner's standing rule (visual validation is done from the owner's own
  screenshots), this is **deferred to owner visual QA** — see `manifest.json` for
  the capture spec (routes/stories × viewport × state). `storybook-static/` is built
  for reference. Nothing here is screenshot-verified by the agent.

**Not merged. Not deployed.**
