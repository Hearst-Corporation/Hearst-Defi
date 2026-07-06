# Workstream D — Invest Flow  ·  STATUS: ✅ already shipped; palette polished in PROMPT #072

## Reality
The 4-step invest flow was **already shipped** end-to-end under `/vaults/**` before #072:
- Routes (`lib/vaults/invest-routes.ts`): `select` → `/vaults` · `product` → `/vaults/[id]` ·
  `deposit` → `/vaults/[id]/invest` · `confirmed` → `/vaults/[id]/invest/confirmed`.
- Shared chrome `InvestFlowShell` + `step-progress.tsx` (labels already **Select → Details → Deposit
  → Confirmed**).
- `ProductSelectCard` already carries `ApyRange`, LIVE badge, Min. ticket, Lock-up, Risk, AUM.
- `TermSheetPreview` (step 2) renders Key Terms + `VaultAllocationInvestorList` donut + capital
  recovery; `InvestForm` (step 3) has amount input, balance check, `time-to-target-chart`, investment
  summary; confirmed step has the success summary.

## Delivered in #072
- `src/components/vaults/vault-allocation-display.tsx` — the Strategy-Pockets donut + legend
  recoloured from the single-green opacity ramp to the **categorical palette** (`--ct-cat-*`), keyed
  by bucket (mining green · BTC amber · USDC blue · reserve graphite). Fixes the "stablecoin
  indistinguishable / two near-identical greens" issue in both the invest-flow donut and the admin
  allocation rows.

## DS primitives used
`ApyRange`, `WizardStepProgress`/`step-progress`, `InvestFlowShell`, HIS donut geometry, categorical
tokens.

## Remaining polish (optional, low priority)
- "RECOMMENDED" badge on the primary vault card if not already present.
- Migrate the bespoke invest-flow donut SVG onto `HcCompositionRing palette="categorical"` for full
  convergence (currently a local SVG that already follows the canonical dasharray convention).

## Validations
`vault-shared-surfaces.test.tsx`, `term-sheet-truth.test.tsx`, typecheck — all green.
