# Workstream C — Vault Details  ·  STATUS: ✅ executed in PROMPT #072

## Scope
Rebuild the per-position Vault Details page (`/portfolio/[positionId]`) into an always-open **Position
Overview hero** + five collapsible accordion sections ("fais mieux": progressive disclosure without
hiding the hero).

## Delivered — `src/app/(product)/portfolio/[positionId]/page.tsx`
Header (back → `/my-vaults`, name, ticker/subscribed kicker, status badge), then:
1. **Position Overview** (`AccordionCard collapsible={false}`) — `ValueTrajectory` + 5-cell
   `BentoKpiStrip` (Deposited / Current Value +% / Yield Paid / Current APY / Maturity) + `LockArc` +
   `CumulativeTargetBullet` + unlock explainer. Mounts the previously-orphaned hero.
2. **Yield History** (`AccordionCard`) — `PositionYieldHistory` (was orphaned, now mounted); series
   from `buildYieldHistory`.
3. **Capital Protection** — safeguard-status card + `StepTimeline` (Monitoring → Trigger → Recovery)
   + `PositionCapitalProtection`.
4. **Strategy Allocation** — `PositionStrategyAllocation`, recoloured to the categorical palette
   (`--ct-cat-*`).
5. **Transactions** — distribution `BentoKpiStrip` (Total distributed / Payouts / Last payout) + real
   transactions `Table` + honest note (no fabricated report downloads).
6. **Infrastructure & Proofs** — `PositionInfrastructureProofs`.

## DS primitives used
`AccordionCard`, `StepTimeline`, `BentoKpiStrip`, `Table`, `Badge`, plus HIS-backed section
components. Engines `projectValueTrajectory` + `buildYieldHistory` (pure, clock injected).

## Honesty decisions
- Lock/maturity: the data model has soft-lockup days, not a per-position 3-year term → `LockArc`
  shows the real soft lock-up; no fabricated "36-month" bar.
- Cumulative target: `CumulativeTargetBullet` stays honest-pending (no methodology target yet).
- Transactions: no fake "Download PDF" — real distribution figures only.

## Validations
Accordion test, HIS honesty tests, product-routes, typecheck — all green.
