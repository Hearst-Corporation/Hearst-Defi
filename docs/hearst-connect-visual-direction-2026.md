# Hearst Connect — Visual Direction 2026

Source: owner archive **Archive 4** (2026-07-05/06), zones `0-MENU`, `1-PORTFOLIO`,
`2-VAULT`, `3-INVEST`. This document is the canon that the four workstreams build against.
It is a **direction**, not a pixel spec — the product-honesty non-negotiables always win over a
mockup detail.

## 1. Design thesis

Premium **institutional** DeFi. Pure black canvas. Green is **assumed and energetic** — it carries
charts, positive values, active/LIVE states and primary CTAs. Cards are readable graphite panels,
not stacked cages. Charts are **alive** (area fills, rounded gradient bars, rings). No neon glow as a
card fill, no box-in-box, **no local mini design systems** — everything flows through the DS.

## 2. Colour system

- **Accent** — the single locked green `--ct-accent` (`#A7FB90`). The specs cite `#96EA7A`; that
  intent maps onto `--ct-accent`. There is no second green and no raw hex (CI-enforced).
- **Categorical data-viz palette** (`--ct-cat-*`, new) — for allocation across **distinct asset
  classes**, so segments never read as "two near-identical greens". Each is an alias of an existing
  status token (no new hex, accent unchanged):
  | Token | Resolves to | Meaning |
  |---|---|---|
  | `--ct-cat-mining` | `--ct-accent` (green) | RWA Mining / positive |
  | `--ct-cat-usdc` | `--ct-status-info` (blue) | USDC / Stablecoin Yield |
  | `--ct-cat-btc` | `--ct-status-warning` (amber) | BTC-correlated / exposure |
  | `--ct-cat-hedge` | `--ct-chart-neutral` (graphite) | BTC hedged / neutral |
  | `--ct-cat-negative` | `--ct-status-danger` (red) | negative deltas (reserved) |

  Green stays the luminance ramp (`--ct-chart-series-1..4`) for **tiers of the same thing**; hue is
  reserved for **different classes**. Amber/red are only for genuinely-negative or triggered states
  (this refines the earlier "no red" preview rule, for data-viz only).

## 3. Product IA & navigation (0-MENU)

Left rail, circular icon + label, active = accent-green label + accent-filled tile. Items are exactly
**Portfolio · Vault · Invest · Profile**. "Proofs" is removed as a standalone entry — its content
folds into **Vault Details → Infrastructure & Proofs**. `/proof-center` stays reachable (deep link +
chat whitelist), just off the rail.

- **Portfolio** → `/portfolio` (dashboard — Workstream B, deferred).
- **Vault** → `/my-vaults` (held positions index; empty state when none). Rows → the per-position
  Vault Details page.
- **Invest** → `/vaults` (catalog + shipped 4-step subscription flow).
- **Profile** → `/profile`.

## 4. Portfolio direction (1-PORTFOLIO — deferred to Workstream B)

Four full-width metric cards; performance area chart starting at the invested baseline with vault
filter pills; allocation donut (categorical) + bucket bars; 12-month yield bar chart; "Your vaults"
active-positions table (row-clickable, green-outline Withdraw when eligible). See
`docs/workstream-prompts/002-portfolio-dashboard.md`.

## 5. Vault Details direction (2-VAULT — shipped in #072)

"fais mieux" synthesis: **Position Overview is an always-open hero**, the five analytical sections
are **polished, state-persisted accordion cards** (`AccordionCard`). Progressive disclosure without
hiding the hero — neither a slavish full-accordion copy nor a flat stack.

1. **Position Overview** (hero): value-trajectory instrument (`ValueTrajectory`/HIS) + 5-cell KPI
   strip (Deposited / Current Value +% / Yield Paid / Current APY / Maturity) + lock gauge + honest
   cumulative-target bullet + unlock explainer.
2. **Yield History**: realized vs projected-range distribution chart + stat band (`PositionYieldHistory`).
3. **Capital Protection**: safeguard-status card + `StepTimeline` (Monitoring → Trigger → Recovery)
   + structural safeguards + capital-at-work.
4. **Strategy Allocation**: categorical pockets bar + legend (`PositionStrategyAllocation`).
5. **Transactions**: distribution KPI strip + real transactions table + honest note (no fabricated
   report downloads).
6. **Infrastructure & Proofs**: on-chain proofs + mining infrastructure (`PositionInfrastructureProofs`).

## 6. Invest direction (3-INVEST — shipped; palette polished in #072)

Already a 4-step flow under `/vaults/**` (`Select → Details → Deposit → Confirmed`, one primary CTA
per step). #072 applied the categorical palette to the Strategy-Pockets donut so the classes read as
distinct. Vault select cards already carry APY range, LIVE, min ticket, lock-up, risk, AUM.

## 7. Shared DS primitives

Consume, never re-create: `AccordionCard`, `StepTimeline`, `HcBarChart`/`HcStackedBar`,
`HcCompositionRing` (+`palette="categorical"`), `HcValueChart`/`HcFanChart`, `HcChartCard`, Catalyst
`Table`/`SegmentedControl`/`EmptySurface`/`Progress`/`CockpitButton`/`BentoBadge`, `BentoKpiStrip`
(+optional `caption`), `WizardStepProgress`. See `docs/hearst-connect-ds-workstream-map.md`.

## 8. Anti-patterns (guarded — `visual-direction-ds-contract.test.ts`)

Page-level mega-card wrapping a canon frame · `.ct-glass-panel` as inner card fill · repeated raw
`rounded/border/bg` without a primitive · inline visual styles · neon glow / box-shadow fills · custom
one-off tables/badges · chart styling inline outside SVG geometry · `bg-[#…]` / `text-white` /
`text-zinc-*` / `border-white/N` / `dark:` modifiers · two DS sources of truth.

## 9. Parallel workstream plan

Foundation (primitives + palette + guard) lands first, then A / B / C / D are independent by file
ownership. #072 shipped Foundation + A (Nav) + C (Vault Details) + D (Invest palette). **B (Portfolio
dashboard) is the deferred next prompt.**
