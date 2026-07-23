# Series 1 — Navigation Proposal

Status 2026-07-23. The final investor navigation, page by page. Companion to
`investor-ui-map.md` and `endpoint-to-ui-matrix.md`. Plan only (PROMPT 025) —
no runtime rebuild in this pass.

> "Not yield. Bitcoin inventory." B2B, proof-backed reserve cockpit.

## Final pages

| Page | Why it exists | What it replaces | Components / instruments | Priority |
|------|---------------|------------------|--------------------------|----------|
| **Dashboard** | One-glance reserve + allocation + subscription + proof snapshot | current `/dashboard` (enriched) | Allocation Cockpit, Reserve Progress arc, Subscription state, Proof snapshot | P1 |
| **Bitcoin Constitution** | B2B doctrine: what Series 1 is, B1/B2/B3, mining power, proof model, maturity, "Not yield." | scattered doctrine in now-retired docs | policy diagram, bucket cards, what-is/what-is-not-proved panel | P3 |
| **Vaults** | Subscription / allocation — B2B ticketing, not retail checkout | `/vaults` + `/vaults/[id]` + invest subflow | Subscription Ladder (100k→1M), vault status, on-chain readout | P2 |
| **Portfolio** | ONE aggregated page: positions, activity, movements, exposure, contribution, export | 6 sub-pages (activity/positions/distributions/tax/yield/preview) | Contribution hero, Positions, Unified Ledger, Exposure, secondary export | P2 (kills worst debt) |
| **Proof Center** | Events, provenance, chain/fork label, indexer freshness — no fake proof | `/proof-center` (kept) | Proof Rail (`Series1ProofEventStepper`), provenance strip, freshness | P1 (shipped) |
| **Profile** | Identity, wallet, KYC/accreditation status, onboarding state | `/profile` (kept) | status chips, onboarding progress | P2 |

## Per-page composition (Hero / Primary / Secondary / Empty / Unavailable / Admin-hidden / Stories)

### Dashboard
- **Hero:** reserve status headline + "Not yield. Bitcoin inventory."
- **Primary:** Allocation Cockpit (B1/B2/B3 target vs actual + drift ring).
- **Secondary:** Reserve Progress arc, Subscription state, Proof snapshot (last event).
- **Empty:** "No accumulation series yet" (already the honest copy).
- **Unavailable:** per-tile unavailable, never a blank dashboard.
- **Admin-hidden:** raw runtime, commitSha, DB latency, RPC codePresent.
- **Stories:** shell, allocation cockpit (live/drift/unavailable), reserve arc (empty/live).

### Vaults
- **Hero:** vault identity + cap + committed-vs-available.
- **Primary:** Subscription Ladder (100k/200k/400k/500k/600k/1M, intent status).
- **Secondary:** on-chain readout (TVL/NAV, fork label), factsheet terms.
- **Empty:** no subscription yet → ladder at 0 committed.
- **Unavailable:** RPC down → honest chip, ladder still shows committed from DB.
- **Admin-hidden:** keeper/rebalancing controls.
- **Stories:** ladder (empty/partial/full/at-cap), on-chain readout (wired/pending/unavailable).

### Portfolio
- **Hero:** contribution summary (committed / available / cap) + BTC/cash exposure.
- **Primary:** Unified Ledger (activity + movements + proof events, one timeline).
- **Secondary:** positions module, exposure breakdown, export/tax behind actions menu.
- **Empty:** honest "one position: $11" or genuinely empty.
- **Unavailable:** per-module.
- **Admin-hidden:** seed/demo rows never shown as real activity.
- **Stories:** unified ledger (live/empty/unavailable), contribution hero (partial/at-cap).

### Bitcoin Constitution
- **Hero:** "Not yield. Bitcoin inventory." + one-paragraph thesis.
- **Primary:** policy diagram (B1/B2/B3 buckets, mining power flow).
- **Secondary:** what is proved / what is not, maturity logic.
- **Empty/Unavailable:** doctrine is static — no data-state.
- **Stories:** full page block, bucket cards.

### Proof Center
- **Hero:** indexer freshness + chain/fork label.
- **Primary:** Proof Rail (event stepper).
- **Secondary:** provenance strip, network mismatch state.
- **Empty:** genuinely no events (not an outage).
- **Unavailable:** transport/DB failure; `SIMULATED` rejected.
- **Stories:** already exist (live/empty/unavailable/simulated-rejected/mismatch).

### Profile
- **Hero:** identity + accreditation status.
- **Primary:** KYC/wallet/onboarding state chips.
- **Secondary:** account controls, sign out.
- **Admin-hidden:** full internal email, dev-bypass mechanics.
- **Stories:** status chips (verified/pending/unavailable).

## Storybook-required (before or with runtime)

Investor nav shell · Dashboard allocation cockpit · Subscription ladder ·
Bitcoin Constitution blocks · Portfolio unified view · Proof Center rail
(exists) · source health / unavailable states. All with test-only fixtures and
live/empty/unavailable + desktop/laptop/mobile.
