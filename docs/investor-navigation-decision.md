# Investor Navigation — Information Architecture Decision

Status: **applied** (PROMPT 225 · rail cut 5 → 3) · Date: 2026-07-16

This decision is grounded in the **actual rendered content and data provenance** of each
investor surface, not appearance. Every figure on Dashboard, BTC and Mining today resolves
through `FixtureInvestorUiDataSource` (`src/features/investor-ui/data-source/index.ts` →
`getInvestorUiDataSource()` always returns the fixture source; the GPU1 adapter throws
`NOT_WIRED`; `PermissionedDynaVault v2.1` is not deployed). Those three surfaces are stamped
`simulated`/`estimated`. Only **Proof Center** and **Profile** read real infrastructure
(on-chain events/attestations/custody/coverage via `loadProofCenterHubData`, DB-backed
profile via `getProfileDataSource`).

## Surface decision table

| Surface | Unique value | Duplication | Data sufficient | Recommended destination |
|---|---|---|---|---|
| **Dashboard** | The investor's personal position value, allocation/capacity + the single "Allocate capital" subscription CTA, and a one-screen roll-up of pockets + mining pulse + performance + activity. The designed hub and the only place the personal position lives. | It *is* the aggregator, so it re-shows headline data from BTC (take-profit + BTC-range via `PerformancePanel`) and Mining (fleet/month/BTC-earned via `MiningPulse` **and** again in `PocketsComposition` B1). | Fixture-backed, but it is the intended cockpit and the real data will flow through the same seam. Sufficient as the primary. | **KEEP AS PRIMARY** |
| **BTC** | Richest product *narrative*: reserve + p5/p50/p95 accumulation fan chart, 6-month production history, take-profit ladder (4 tiers), Fireblocks custody, event timeline, proof links. | Its `Performance` block is the **same** `BtcViewModel.performance` already rendered by Dashboard's `PerformancePanel`; its estimated 9.4–12.8% range also appears on Dashboard; its proof links already point at `/proof-center`; its AI-experts rail mirrors Dashboard's. | No — 100% fixture (`btc-page-fixtures.ts`), no backend, contract not deployed. Depth is structural, not real data. Does not justify a co-equal primary rail seat. | **KEEP ROUTE, REMOVE FROM NAV** |
| **Mining** | An institutional "control-room" schematic (Mining Power → Pool → Production → Reserve → Electricity) + 8 operational KPI tiles (hashrate, cumulative BTC, term progress, fleet state, electricity cost/paid/status, vending curve). | Fleet status / BTC earned / term month / last report are **already** on Dashboard twice (`MiningPulse` + `PocketsComposition` B1). The only real chart (production history) lives on **BTC**, not here. | No — thinnest of the three: one fixture object (`miningCompleteFixture`), a schematic + KPI strip. No hashrate-evolution chart, no per-rig fleet/telemetry, no incidents, no history, no energy timeline. Fully simulated. | **KEEP ROUTE, REMOVE FROM NAV** |
| **Proof** | The **only real-data trust surface**: on-chain event log, PoR attestations, custody snapshot, coverage, distributions, rebalances, contracts & governance timelocks (2-layer hub + `/proof-center/full`). Genuine compliance destination for an institutional note. | Overlaps only conceptually with the proof references scattered on BTC/Dashboard — but those already **link into** it (it is the canonical home, not a duplicate). | Yes — real plumbing (chain + Prisma), though testnet/cold-empty aware. Real, but a trust *utility*, not a product-story peer. | **KEEP AS SECONDARY** |
| **Profile** | Real account/identity: KYC, accreditation, wallet, security/sessions, preferences, documents, subscription history — DB-backed, not fixtures. | None material. Self-contained account surface. | Yes — real DB data via `profile-data-source`. | **KEEP AS PRIMARY** |

## Recommended navigation

Collapse the 5-entry rail to **3 investor-simple entries**:

```
Dashboard   ·   Proof   ·   Profile
```

- **Dashboard** — the hub. Position, allocation + CTA, pockets B1/B2/B3, one mining pulse
  line, one compact performance summary, activity. From here, two drill-down links open the
  deep detail pages (the pattern already exists: "Full mining report →" in `MiningPulse`,
  and now "BTC accumulation detail →" in `PerformancePanel`).
- **Proof** — kept in the rail but positioned as a **secondary trust utility**, not a
  co-equal product peer. It is already reached contextually from BTC's "Proofs & provenance"
  panel and events (4 links to `/proof-center` + `/proof-center/full`), so contextual exposure
  is preserved even at reduced nav weight.
- **Profile** — account/identity, real data, stays primary.

**BTC** and **Mining** leave the rail but **keep their routes** as Dashboard drill-downs:
- Dashboard `PerformancePanel` → "BTC accumulation detail →" → `/btc`
- Dashboard `MiningPulse` → "Full mining report →" → `/mining` (link already present)

## Rationale per surface

- **Dashboard (KEEP AS PRIMARY).** It is the only surface carrying the personal position and
  the subscription funnel, and it already summarizes mining, pockets and performance. Making it
  the single hub is what removes the duplication rather than adding to it.
- **BTC (KEEP ROUTE, REMOVE FROM NAV).** It has the most content, but (1) all of it is
  simulated, (2) its `Performance` block is a verbatim duplicate of Dashboard's, and (3) it and
  Mining read as two disconnected demos (inconsistent fixtures: BTC = month 6 / 2.8 BTC vs
  Mining = month 9 / 412.5 TH/s / 0.184 BTC). Its rich narrative earns a *detail page*, not a
  primary rail seat that a fixture cannot back.
- **Mining (KEEP ROUTE, REMOVE FROM NAV).** A schematic + 8 KPI tiles from one fixture, with
  its headline already on Dashboard twice. It has none of the operational depth (hashrate
  history, fleet telemetry, incidents) that would justify standing alongside Dashboard. Keep the
  route as the "Full mining report" drill-down.
- **Proof (KEEP AS SECONDARY).** The instinct that it is over-elevated as a 5-peer top entry is
  right. But it is the one surface with real data and it matters for institutional trust, and
  BTC already links into it contextually. So: de-elevate to a secondary utility, keep the route
  and one rail tap, lean on the existing contextual links.
- **Profile (KEEP AS PRIMARY).** Real, DB-backed, self-contained account home. No change.

## What stays a route vs. what leaves the rail

- **Stays in the rail:** Dashboard (primary), Proof (secondary), Profile (primary).
- **Leaves the rail, route preserved (KEEP ROUTE, REMOVE FROM NAV):** `/btc`, `/mining` —
  reachable via Dashboard drill-down links and direct URL, exactly as `/portfolio`,
  `/vaults/[id]/invest`, `/proof-center/full` and `/my-vaults` already sit off the rail today.
- **No routes deleted in this pass.** `PRODUCT_NAV` in
  `src/components/nav/product-nav-items.ts` drops the `btc` and `mining` entries; the pages,
  their components, fixtures and tests remain intact so BTC/Mining can return to the rail (or
  fold into Dashboard) the moment real GPU1/contract data backs them.

## Next pass (gated on data)

BTC and Mining return to the rail — or fully fold into the Dashboard as sections/drawers — the
moment `getInvestorUiDataSource()` resolves the live GPU1 adapter (real hashrate history, fleet
telemetry, on-chain reserve/accumulation) instead of `FixtureInvestorUiDataSource`. Until then
the rail stays at three, and the depth pages stay reachable as drill-downs.
