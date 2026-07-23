# Series 1 — Investor UI Map (endpoints → visual intelligence)

Status 2026-07-23. Companion to `endpoint-to-ui-matrix.md`,
`series1-navigation-proposal.md`, `backend-ecosystem-map.md`, `kpi-catalog.md`.
Prepared as a **plan** (PROMPT 025) — no Dashboard rebuild, no route deletion,
no backend change in this pass.

> **Canonical framing — "Not yield. Bitcoin inventory."** Series 1 is a Bitcoin
> reserve construction and maturity-delivery product. Nothing in this map is a
> yield / APY / coupon / distribution claim. B2B, proof-backed, cockpit — not
> retail, not DeFi casino.

The governing rule: **endpoint ≠ page.** The nav is the shell (few, stable
destinations); endpoints are plumbing; the investor sees *composed, calculated*
visual instruments. Several endpoints can feed one instrument. A page composes
signals, it does not expose the technical structure.

---

## 1. Target navigation (6 items, one variant to 5)

| # | Nav item | Purpose | Replaces / absorbs |
|---|----------|---------|--------------------|
| 1 | **Dashboard** | Overview: allocation cockpit, subscription state, reserve progress, proof snapshot | `/dashboard` (kept, enriched later) |
| 2 | **Bitcoin Constitution** | B2B-readable product doctrine: what Series 1 is, buckets B1/B2/B3, mining power, proof model, what is / is not proved, maturity logic, "Not yield. Bitcoin inventory." | new page (doctrine was scattered in now-retired docs) |
| 3 | **Vaults** | Subscription / allocation. B2B ticketing: intent → allocation → status. Ladder 100k/200k/400k/500k/600k → 1M cap. Not a retail checkout. | `/vaults`, `/vaults/[id]`, `/vaults/[id]/invest*` (kept as subflow) |
| 4 | **Portfolio** | ONE page aggregating positions + activity + historical movements + cash/BTC exposure + contribution status + tax/export (secondary) | merges 6 sub-pages → 1 (see §3) |
| 5 | **Proof Center** | Events, provenance, chain/fork/mainnet, indexer freshness. No fake proof. | `/proof-center` (kept; `/proof-center/full` → admin or secondary) |
| 6 | **Profile** | Identity, wallet, accreditation/KYC status, onboarding state | `/profile` (onboarding stays technical, not primary nav) |

**5-item variant (justified):** fold **Bitcoin Constitution** into the Dashboard
as a "Constitution" hero tab OR as the Vaults page preamble. Recommendation:
**keep it a 6th item.** A B2B reserve product sells on doctrine and proof
discipline; burying the "what is / is not proved" statement inside a data
dashboard weakens the single strongest trust asset. A standalone, linkable
Constitution page is a sales/legibility surface a tab cannot replace. Ship 6.

---

## 2. Routes — keep / merge / hide / delete

Central test: **"Would a B2B investor deliberately click here?"**

### Investor nav (Keep — primary)
| Route | Verdict | Destination |
|-------|---------|-------------|
| `/dashboard` | Keep | Nav 1 |
| `/vaults` | Keep | Nav 3 |
| `/vaults/[id]` | Keep (subflow) | under Vaults |
| `/vaults/[id]/invest`, `/invest/confirmed` | Keep (subflow) | under Vaults |
| `/portfolio` | Keep — becomes the ONE portfolio page | Nav 4 |
| `/proof-center` | Keep | Nav 5 |
| `/profile` | Keep | Nav 6 |

### Investor subflow (Keep, not top-level nav)
| Route | Verdict | Reason |
|-------|---------|--------|
| `/onboarding`, `/onboarding/identity`, `/wallet`, `/accreditation` | Keep, technical | onboarding is a gated flow, not a browse destination |
| `/btc`, `/btc/ledger`, `/bitcoin` | Keep, evaluate | BTC ledger surface — fold into Portfolio "BTC exposure" if thin; keep if it stands alone |

### Merge → Portfolio (do NOT delete — merge)
| Route | Verdict | Destination |
|-------|---------|-------------|
| `/portfolio/activity` | Merge | Portfolio → activity timeline module |
| `/portfolio/positions` | Merge | Portfolio → positions module |
| `/portfolio/distributions` | Merge/rename | Portfolio → movements. **Naming caution: "distributions" is yield-adjacent vocabulary** — reframe as capital movements / redemptions, never "distributions" as income |
| `/portfolio/tax` | Merge (secondary) | Portfolio → export/tax in secondary controls |
| `/portfolio/yield` | **Merge + reframe or hide** | **"yield" contradicts the canon.** Content must not present a yield figure for Series 1. Fold any legitimate part into Portfolio; otherwise hide |
| `/portfolio/preview` | Hide (dev/sandbox) | preview/sandbox — not an investor destination |

### Hide / admin-only (never investor nav)
| Route | Verdict | Reason |
|-------|---------|--------|
| `/mining` | Hide from investor nav | mining telemetry is admin-grade (stale cron); expose only *derived* mining economics inside Dashboard when real |
| `/my-vaults` | Evaluate vs `/vaults` | likely duplicate intent — reconcile with `/vaults`, do not keep two vault lists |
| `/proof-center/full` | Secondary or admin | the "full" firehose is not the primary proof read |
| all `admin/**` (40+ routes) | Admin-only | never investor nav (agentic, outreach, governance, diagnostics, design-system, source, spec, …) |

No route is **deleted** in this pass (MISSION H forbids mass route deletion).
Merges/hides are specified here and executed in a later implementation pass.

---

## 3. The Portfolio consolidation (the core "endpoint ≠ page" fix)

Today: 6 sub-pages (activity / distributions / positions / tax / yield / preview).
This is the clearest "one datum = one page" symptom. Target: **one Portfolio page**
with modules, not routes:

- **Hero** — contribution summary (committed vs. available vs. cap) + BTC/cash exposure
- **Positions module** — the real positions (1 REAL_PRODUCTION $11 + honest empties)
- **Unified ledger** — activity + movements + proof events on one timeline
- **Exposure** — cash/USDC vs. BTC inventory attributed
- **Secondary controls** — export / tax tucked behind an actions menu, not a tab
- Every module carries its own live / empty / unavailable state.

---

## 4. Visual instruments (MISSION C) — several endpoints → one instrument

| Instrument | Sources (endpoints) | Visual | Status today |
|-----------|---------------------|--------|--------------|
| **Allocation Cockpit** | `getVaultStrategiesFromBackend` (actualBps, driftBps) + `getProductFactsheetFromBackend` (targetBps) | B1/B2/B3 band, target vs actual, drift ring | **Live** — already partly shipped on `/dashboard` |
| **Subscription Ladder** | `getVaultFromBackend` (minimumDepositAtomic, hard cap) + `getProfileFromBackend` (eligibility) + position | ladder 100k/200k/400k/500k/600k/1M, committed vs available, intent status | Buildable now |
| **Reserve Progress** | `getBtcFromBackend` (totalSats) + `getProductFactsheetFromBackend` (term) + proof status | progress arc, reserve state, **empty if BTC ledger absent** | Arc yes; monthly series **NOT_CONFIGURED** (no indexer decode) |
| **Proof Rail** | `getSeries1EventsFromBackend` (chainId, txHash, blockNumber, indexedAt) | event stepper, provenance strip, fork/mainnet label, mismatch state | **Live** — shipped (`Series1ProofEventStepper`) |
| **Mining Economics Band** | `getMiningFromBackend` + `getMiningElectricityFromBackend` + live hashprice | economics tiles — **only if real data**, else `not_configured` | **Admin-grade only** (dead cron since 2026-07-07) |
| **Portfolio Unified Ledger** | positions + activity + `getSeries1EventsFromBackend` + vault status | unified timeline, contribution summary, export hidden in secondary | Buildable now |
| **Bitcoin Constitution** | `getProductFactsheetFromBackend` (terms, buckets) + proof rules | policy diagram, bucket explanation, what is / is not proved | Doctrine content exists; page to build |

**Honesty gates (from `kpi-catalog.md`, enforced):** a formula never renders with
a fabricated input. `NOT_CONFIGURED`/`UNAVAILABLE` → "not available", never a
silent zero. `SIMULATED` is never drawn as a reachable live state. Mining tiles
stay admin-grade until the cron is restored and the two hashprice pipelines are
reconciled.

---

## 5. What is NOT available yet (do not fake)

Per `backend-ecosystem-map.md` §10 and `kpi-catalog.md` gaps:
- Monthly BTC accumulation series — no producer (indexer decodes only
  Deposit/Redeem/ElectricityPaid, not `MiningMetricsReported`).
- Reserve build rate, cost-per-BTC, break-even hashprice, maturity readiness
  composite — all blocked on the monthly series.
- Any mainnet event (today: fork chainId 31337 only).
- Production custody attestation (`BtcCustody.proofOfReserveAttestedAt` unpopulated).

---

## 6. Build priority (next passes, not this one)

1. **Investor navigation shell** (6 items) + Storybook story — highest leverage, low risk.
2. **Portfolio consolidation** (6 → 1) — kills the worst endpoint=page debt.
3. **Allocation Cockpit** enrichment on Dashboard (already partly live).
4. **Subscription Ladder** on Vaults.
5. **Bitcoin Constitution** page.
6. Mining Economics Band — **gated** on cron restoration + hashprice reconciliation.
