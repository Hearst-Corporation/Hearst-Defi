# Series 1 — KPI catalog

Status as of 2026-07-23. Every row below is backed by a real field cited to
its source file — nothing here is a proposed field that does not exist yet
in the contract. Where a KPI cannot be computed today, that is stated as
`status: not available` rather than omitted, per doctrine §10 (no fake zero).

This is not a yield product. Every KPI below describes Bitcoin inventory,
mining economics, allocation, proof, or operational risk — never a yield,
APY point, coupon, or distribution rate. `ApyRange` (low–high, disclaimed)
remains a legitimate generic primitive elsewhere in the repo; it is not used
here because Series 1 itself is not being measured as a yield product.

Confidence levels use the source's own status vocabulary — `DataStatus`
(`LIVE | STALE | PARTIAL | UNAVAILABLE | NOT_CONFIGURED | NOT_SUPPORTED |
PERMISSION_DENIED`, `src/lib/backend/contracts.ts:37-44`) mapped to envelope
`EnvelopeStatus` (`LIVE | SNAPSHOT | STALE | SIMULATED | NOT_CONFIGURED |
UNAVAILABLE`, `contracts.ts:17`) worst-field-first
(`hearst-connect-backend/docs/data-sources.md:101-108`). `SIMULATED` is a
valid type value that no code path produces today — do not treat it as a
reachable KPI state.

---

## A. Reserve / Bitcoin Inventory

| KPI | Source | Formula | B2B exposure | Confidence | Status |
|---|---|---|---|---|---|
| BTC reserve built (cumulative) | `BtcDTO.btcProduced.totalSats` (`contracts.ts:317-320`) | direct read | Yes | LIVE when v2.1 chain answers | Live on fork (31337); NOT_CONFIGURED pre-mainnet |
| Monthly BTC accumulation series | `BtcDTO.production.monthly[]` (`contracts.ts:334-344`) | direct read, one point per period | Yes | — | **Not available** — always `NOT_CONFIGURED`; no indexer decodes `MiningMetricsReported` yet (indexer only handles Deposit/Redeem/ElectricityPaid, `hearst-connect-backend/src/application/series1-indexer.ts:127-158`) |
| Capital deployed | `VaultSnapshot.totalAssets` (`contracts.ts:64-73`) | direct read | Yes | LIVE/NOT_CONFIGURED per contract state | — |
| Reserve build rate | derived from `production.monthly` | `Δ cumulativeBtcEarned / Δ period` | Yes | — | **Not available** — depends on the monthly series above, which does not exist yet |
| Maturity delivery estimate | `FactsheetTerms.productDurationMonths` (`contracts.ts:486-494`) + current accumulation | `term_months − months_elapsed`, paired with current `totalBtcEarnedSats` as a floor, never a promised final number | Yes, framed as "as of today, not a guarantee" | manual (term) + LIVE (accumulation) | Term is manual/named-constant provenance; accumulation LIVE only post-mainnet |
| Reserve coverage ratio | `ReserveSummary.reserveUsdc` (`contracts.ts:146-150`) vs. `electricityCoveredMonths` | `reserveUsdc / monthlyElectricityCost` | Admin + B2B (coverage months only) | LIVE when B3 pocket answers | — |

## B. Mining Economics

| KPI | Source | Formula | B2B exposure | Confidence | Status |
|---|---|---|---|---|---|
| Hashprice | `MiningTelemetryRow.hashprice` (backend, `mining-repository.ts:23-37`) **or** live-computed `HashpriceData.usd_per_th_day` (frontend, `src/lib/data/hashprice.ts:38-51`) | direct read (DB) or mempool.space+Coingecko composite (live) | Admin only until reconciled | STALE — `MiningMetric` series unrefreshed since 2026-07-07 (dead cron, `hearst-connect-backend/docs/data-hygiene-series1.md:20`) | **Two distinct sources exist under the same name — do not conflate.** Report both, pick one explicitly before shipping a client-facing tile |
| Deployed hashrate | `MiningTelemetryRow.deployedHashrateTh` (`mining-repository.ts:23-37`, renamed from DB column `deployedHashrate`) | direct read | Admin only | STALE (same dead-cron caveat) | — |
| Network difficulty | `MiningTelemetryRow.difficulty` | direct read | Admin only | STALE | — |
| Energy cost | `MiningTelemetryRow.energyCost` / `MiningElectricityDTO.electricity.monthlyCost` (`contracts.ts:212-219`) | direct read | B2B (monthly cost only, not raw telemetry) | LIVE (electricity, chain-backed) / STALE (telemetry) | — |
| Uptime | `MiningTelemetryRow.uptimePct` | direct read | Admin only | STALE — flagged in the hygiene audit as "carried placeholder", not measured (`data-hygiene-series1.md:81`) | Do not present as investor-grade |
| Cost-to-BTC conversion | `electricity.monthlyCost` / `btcProduced` for the same period | `electricityCostUsd / btcProducedSats` | B2B, framed as historical, not projected | derived from LIVE + NOT_CONFIGURED inputs | **Not available** until monthly production series exists (same gap as reserve build rate) |
| Break-even hashprice | `energyCostPerTh / btcRevenuePerTh` | derived | Admin only | — | **Not available** — `btcRevenuePerTh` has no source field today |
| Mining contribution to reserve | `btcProduced.totalSats` attributed vs. total reserve | `attributedBtcSats / totalReserveBtc` (uses `BtcAttribution`, `contracts.ts:328-332`) | B2B | LIVE when attribution answers | `BtcAttribution.lastVerifiedAt` gates freshness |

## C. Capital Allocation

| KPI | Source | Formula | B2B exposure | Confidence | Status |
|---|---|---|---|---|---|
| Policy target B1/B2/B3 | `FactsheetAllocation.pockets[].targetBps` (`contracts.ts:481-484`) or `AllocationPocket.targetBps` (`contracts.ts:134-139`) | direct read | Yes | manual (factsheet) / LIVE (on-chain) | Already shipped on `/dashboard` (Pocket Allocation module) |
| On-chain allocation | `VaultStrategy.actualBps` (`contracts.ts:75-83`) | direct read | Yes | LIVE | — |
| Allocation drift | `VaultStrategy.driftBps` (already a first-class field, `contracts.ts:75-83`) | `actualBps − targetBps` (matches the existing field; do not recompute independently) | Yes | LIVE | — |
| Variance target vs. actual (dashboard framing) | same as above, per pocket | `Σ |actualBps − targetBps|` across B1/B2/B3 | Yes | LIVE | Already the "gap is the information" framing on `/dashboard` Pocket Allocation |
| Operating reserve coverage | see Reserve coverage ratio (A) | — | Admin + B2B (months only) | — | duplicate of A, listed here for the allocation-family reader |
| Reserve runway | `reserveUsdc / monthlyElectricityCost`, expressed in months | `electricityCoveredMonths` (already a first-class field, `ElectricityStatus`-adjacent) | Yes | LIVE | — |

## D. Proof / Provenance

| KPI | Source | Formula | B2B exposure | Confidence | Status |
|---|---|---|---|---|---|
| Indexed events count | `Series1EventSummary[]` length (`contracts.ts:558-574`) | `count(events)` | Yes — already shipped on `/proof-center` | LIVE / NOT_CONFIGURED / UNAVAILABLE | Live: 6 events, chainId 31337 (`data-hygiene-series1.md:26`) |
| Last indexed block | `max(events.blockNumber)` | `max()` over the event set | Yes | same as above | — |
| Last proof event | `events` sorted by `(blockNumber, logIndex)` desc, take first | direct | Yes | same as above | Already the stepper's sort order (this session's prior commit) |
| Proof completeness | observed event names vs. `VaultEventName` union (`contracts.ts:232-246`, 14 members) | `count(distinct eventName observed) / 14` | Admin (raw ratio); B2B (qualitative "N of N expected event types seen") | LIVE for observed / by-design for expected | Only 3 of 14 names get typed decoding today (Deposit/Redeem/ElectricityPaid) — the other 11 land in the event stream once emitted, decoded generically |
| Source status | `Resolved.status` / `Envelope.meta.status` per field | direct read | Yes — already the `ProvenanceBadge` contract | n/a (this IS the confidence signal) | — |
| Chain provenance | `Series1EventSummary.chainId` (`contracts.ts:562`) mapped to fork/mainnet/mismatch | `chainId === 31337 → fork`, known mainnet ids → mainnet, else → mismatch | Yes — already shipped (`Series1ProofEventStepper`, this session) | LIVE | — |
| Replay/idempotence status | indexer's `(chainId, txHash, logIndex)` uniqueness (`hearst-connect-backend/src/persistence/series1-event-repository.ts:18-30`) | boolean: did the last run skip only replays, or write new rows | Admin only | operational, not a data-status field | Reported per indexer run (`indexedCount`/`skippedCount`), not persisted as a queryable KPI today |

## E. Risk / Operations

| KPI | Source | Formula | B2B exposure | Confidence | Status |
|---|---|---|---|---|---|
| DB health | `GET /ready` → `{ready, db, latencyMs}` (`hearst-connect-backend/src/api/server.ts:165-169`) | direct read | Admin only | live/unreachable, unauthenticated probe | — |
| RPC health | `ContractRuntimeStatus.codePresent` (`contracts.ts:265-271`) | direct read | Admin only | LIVE/NOT_CONFIGURED | Fork sleeps (Fly autosleep) — `codePresent:false` observed while indexed rows persist (`PRODUCTION_READINESS_REPORT.md:117-119`) |
| Indexer freshness | `RuntimeReport.indexer.lastSyncedAt` (`hearst-connect-backend/src/application/runtime.ts:25-38`) | `now − lastSyncedAt` | Admin only | live/unreachable | — |
| Unavailable sources count | count of DTO fields at `UNAVAILABLE`/`NOT_CONFIGURED` across the dashboard/btc/mining responses in one read | `count(fields where status ∈ {UNAVAILABLE, NOT_CONFIGURED})` | Admin only | derived | — |
| Stale telemetry | `MiningMetric` freshness | `now − takenAt` on the latest row | Admin only | STALE (confirmed 15+ days as of the hygiene audit) | Live example of the KPI itself being in a degraded state |
| Network mismatch | per-event `chainId` outside the expected set | boolean per event | Yes — already shipped (this session's stepper) | LIVE | — |
| Fork vs. mainnet status | `ContractRuntimeMode` (`"v2-testnet" \| "v2-mainnet" \| "v2-fork" \| "not_configured"`, `contracts.ts:263`) | direct read | Yes | LIVE | Today: `v2-fork`, chainId 31337 |
| Proof gaps | events NOT observed for a given `VaultEventName`, since deployment | `expected − observed` set difference | Admin (full list); B2B (qualitative) | derived | Same 3-of-14-decoded caveat as Proof completeness above |

---

## Formulas — canonical definitions

Each formula below states its exact inputs. **A formula is never rendered with
a fabricated input** — if any input is `NOT_CONFIGURED`/`UNAVAILABLE`, the KPI
renders "not available", never a computed value with a silently-substituted
zero.

1. **Allocation drift** — `actualAllocationPct − policyTargetPct`. Already a
   first-class field: `VaultStrategy.driftBps` (`contracts.ts:81`). Do not
   recompute from `targetBps`/`actualBps` independently — use the field.

2. **Reserve coverage** — `availableReserveUsdc / projectedMonthlyOperatingCost`.
   Inputs: `ReserveSummary.reserveUsdc`, `ElectricityStatus.monthlyCost`.
   Both LIVE-gated on the electricity/B3 chain read.

3. **Cost per BTC** — `electricityCostUsdOverPeriod / btcProducedSatsOverPeriod`.
   Requires a period-scoped production series. **Not computable today** — the
   only production field is `btcProduced.totalSats`, a running cumulative
   total, not a per-period series (`BtcDTO.btcProduced`, `contracts.ts:317-320`).

4. **Break-even hashprice** — `energyCostPerTh / btcRevenuePerTh`.
   `energyCostPerTh` has no direct field (only aggregate `monthlyCost`
   exists); `btcRevenuePerTh` has no field at all. **Not computable today.**

5. **Proof freshness** — `now − lastIndexedEvent.indexedAt`. Uses
   `Series1EventSummary.indexedAt` (`contracts.ts:573`) — the indexer's own
   technical write time, never `occurredAt` (the on-chain block time, which
   can legitimately be null and must never substitute for indexing lag).

6. **Event completeness** — `count(distinct eventName in observedEvents) /
   count(VaultEventName union members)`. 14-member union at `contracts.ts:232-246`;
   only 3 (Deposit/Redeem/ElectricityPaid) get typed-column decoding today —
   the other 11 still land in the raw event stream once emitted
   (`series1-indexer.ts:149-158` preserves them in a JSON `raw` column with
   typed amount columns left null), so this ratio is computable today, it is
   just structurally capped low until more event types are emitted on-chain.

7. **Fork provenance ratio** — `count(events where chainId = 31337) /
   count(events)`. Computable today: as of the 2026-07-22 hygiene audit,
   this ratio is 1.0 — every indexed event is fork-only
   (`data-hygiene-series1.md:26`).

8. **Data confidence score** — weighted by envelope status, worst-first:
   `LIVE (1.0) > STALE (0.6) > SNAPSHOT (0.4) > NOT_CONFIGURED (0.1) >
   UNAVAILABLE (0.0)`. This mirrors the backend's own worst-field-first
   composite rule (`hearst-connect-backend/docs/data-sources.md:104-106`);
   the weights above are a UI convenience for sorting/coloring, not a new
   backend contract — never persist them as if they were a backend-computed
   field.

9. **Maturity readiness** — a function of: term elapsed
   (`FactsheetTerms.productDurationMonths` vs. `MiningEngineStatus.currentMonth`),
   proof completeness (formula 6), reserve build (A, "Reserve build rate" —
   **currently not available**), operational reserve (Reserve coverage,
   formula 2), indexer freshness (formula 5). **Not computable as a single
   number today** — one of its five inputs (reserve build rate) has no data
   source. Render each sub-input's own status individually; do not collapse
   into a fake composite score while a component is missing.

---

## Explicit gaps (do not silently paper over)

- Monthly BTC accumulation series (`production.monthly`) has no producer —
  the indexer decodes Deposit/Redeem/ElectricityPaid only, never
  `MiningMetricsReported`. This blocks KPIs A "reserve build rate", A "cost
  per BTC" (family B), and formula 9 entirely.
- `MiningMetric` (hashprice/difficulty/uptime/deployedHashrate) has been
  stale since 2026-07-07 — a dead cron, not a live feed
  (`data-hygiene-series1.md:20,80-84`). Any KPI sourced from it is
  admin-grade, not investor-grade, until the cron is restored.
- Two different "hashprice" computations exist under the same name (DB
  column vs. live `mempool.space`+Coingecko composite in
  `src/lib/data/hashprice.ts`) — pick one explicitly before exposing a
  client-facing hashprice tile; do not average or silently prefer one.
- `SIMULATED` is a valid `EnvelopeStatus` value with no producing code path
  — never draw it as a reachable state in a live status flow.
