# Workstream B — Portfolio Dashboard  ·  STATUS: ⏳ DEFERRED (the live next prompt)

The Portfolio dashboard (`/portfolio`) was **explicitly excluded** from PROMPT #072. This is the
next prompt. Build it against the Visual Direction 2026 canon and the primitives already shipped.

## Scope — 5 modules (Archive 4 / `1-PORTFOLIO`)
1. **Metric strip** — four equal, full-width cards: Portfolio Value (+$Δ +% green) · Yield Earned To
   Date · Next Distribution (relative) · Positions. Remove the old "Account / Key metrics / BTC
   icon". Big primary value, much smaller secondary. → `BentoKpiStrip` (now supports `caption`).
2. **Portfolio Value** — `HcValueChart` starting at the **invested baseline** (dashed reference, not
   $0), Y auto-scaled, LIVE pill, `SegmentedControl` vault filters (hidden when one vault), 12
   months, full width, title white / subtitle "Historical performance".
3. **Allocation overview** — `HcCompositionRing palette="categorical"` (donut = overall, unchanged by
   filter) + right-side bucket bars with their own vault `SegmentedControl`. 3 buckets:
   BTC-correlated / Mining infrastructure / Stablecoin yield. Center total = Portfolio Value.
4. **Yield paid** — `HcBarChart` (12 months, `highlightLast`, tooltip), right-corner vault filter,
   subtitle "Last 12 months · USDC payout history".
5. **Your vaults** — active-positions `Table`: Vault · Deposited · Current Value (+% green) · Lock
   Progress (bar + "18 / 36 months") · Next Distribution (relative) · Actions (arrow, or a
   green-outline **Withdraw** on eligible rows). Whole row clickable + hover lighten. Green "Invest
   in a vault" CTA. No APY column. Names Vault 1/2/3.

## Files
`src/app/(product)/portfolio/page.tsx` (restructure); reuse `loadPortfolio` / `loadAllocationDonutProps`.

## DS primitives to consume (do NOT hand-roll)
`BentoKpiStrip`, `HcChartCard`, `HcValueChart`, `HcBarChart`, `HcCompositionRing` (`categorical`),
`SegmentedControl`, `Table`, `CockpitButton`. Kill the hand-rolled `KPI_TILE` string + inline card
shells + inline `boxShadow`.

## STOP conditions / honesty
- Lock Progress needs a real term — do NOT fabricate "X / 36 months" if the term isn't in the data;
  either load it or show an honest tenure. APY always a range. Empty states never fake a value.
- Keep `portfolio-real-data-contract.test.ts` green (real loaders, HIS primitives, no mock literals).
- Segmented filters that need cross-vault series require per-vault data — only expose filters that
  have real data behind them.

## Visual QA
Adrien screenshots at full screen; compare to `Archive 4/1-PORTFOLIO/*`.
