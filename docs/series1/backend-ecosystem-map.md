# Series 1 — backend ecosystem map

Status as of 2026-07-23. Companion to `docs/series1/kpi-catalog.md` and
`docs/visuals/series1-backend-ecosystem-canvas.html`. Every claim below is
cited to a file in one of the two repos on this disk:
`connect — Hearst Defi` (frontend) and `hearst-connect-backend` (backend,
independent git repo, `github.com/Hearst-Corporation/hearst-connect-backend`).

This is a Bitcoin reserve construction and maturity delivery product, not a
yield product — see `docs/design-system/DS_DOCTRINE_LOCKED.md` §11. Nothing
in this map should be read as a yield/APY/distribution claim.

## 1. Topology, exactly as documented

```
Frontend (Next.js, connect — Hearst Defi)
    │  server-only client, Bearer token — src/lib/backend/server-client.ts
    ▼
https://connect-api.hearst.app  (Cloudflare tunnel, managed via Cloudflare
    │                             API, independent of the GPU1 host's local
    │                             cloudflared config)
    ▼
GPU1 host — container "hearst-connect-backend-app" → 127.0.0.1:3901
hearst-connect-backend (node:http, no framework, src/api/server.ts)
    │  Prisma (@prisma/adapter-pg), read-only: 9 call sites, all find*
    ▼
Supabase Postgres — the SAME database Connect's own Prisma layer reads
    (not a second database — hearst-connect-backend/docs/architecture.md:31)

Separately, for on-chain reads/indexing:
Series1 indexer (hearst-connect-backend/src/application/series1-indexer.ts)
    ▼ RPC_URL
hearst-chain.fly.dev — chainId 31337, DynaVault v2.1 fork/preprod
    (Fly hosts ONLY the chain fork here — never the backend API. The backend
     lives on GPU1. hearst-chain.fly.dev sleeps on Fly's autosleep tier;
     indexed rows persist in Postgres even when the live RPC is unreachable —
     PRODUCTION_READINESS_REPORT.md:117-119.)
```

**Port note (resolved, not a real conflict):** `EXPOSE 3900` is the port
*inside* the Docker image; GPU1 publishes the container on
`127.0.0.1:3901` with `PORT=3901`
(`hearst-connect-backend/docs/architecture.md:188-189`). Some earlier
`docs/gpu1-*` files in the frontend repo cite 3900 for the same service —
that is the in-image port, not the externally reachable one; do not treat
this as an open discrepancy.

**Documentation-drift note (real, unresolved):** `hearst-connect-backend/docs/architecture.md:192-201`
("Why the frontend does not consume this today") states the frontend still
hardcodes a fixture data source and this backend is "not yet called by
anything in production." That is stale relative to this session's own work:
`/dashboard` and `/proof-center` in `connect — Hearst Defi` now call
`getSeries1EventsFromBackend()` / `getVaultFromBackend()` and the rest of
`src/lib/backend/server-client.ts` for real. Treat the backend repo's
architecture doc as describing an earlier integration state, not current
reality — the two repos' docs were not kept in sync at the same cadence.

## 2. GPU1 — the backend host

- Independent git repository, `hearst-connect-backend`, extracted from the
  frontend monorepo via `git-filter-repo`
  (`hearst-connect-backend/docs/architecture.md:34-43`). "GPU1" now means
  the physical host only, not a workspace package — an earlier
  `docs/gpu1-backend-architecture.md` (frontend repo) description of it as a
  monorepo workspace is stale.
- `GET /health` → `{ "status": "ok" }`, unauthenticated
  (`hearst-connect-backend/src/api/server.ts:163`).
- `GET /ready` → `{ ready: true, db: "ok", latencyMs }` on success, `503
  { ready: false, db: "unreachable" }` on failure
  (`hearst-connect-backend/src/api/server.ts:165-169`).
- `GET /api/v1/runtime` → `RuntimeReport`: `serviceVersion`, `commitSha`
  (from `env.GIT_COMMIT_SHA`, baked at image build via `ARG
  GIT_COMMIT_SHA`), `environment`, `uptimeSeconds`, `db: {reachable,
  latencyMs}`, `databaseStatus`, `lastSuccessfulDbCheck`, `providerMode:
  "gpu1-supabase"` (fixed literal), `contract` (`ContractRuntimeStatus`),
  `contractStatus`, `indexer: {status, lastSyncedAt}`, `indexerStatus`
  (`hearst-connect-backend/src/application/runtime.ts:25-52`).
- Prisma schema owned entirely in this repo, 70 models
  (`grep -c '^model ' prisma/schema.prisma`), but this service reads only
  **7 models across 9 call sites, every one a `find*`** — `Investor`,
  `Position`, `Distribution`, `InvestorTransaction`, `Proof`, `MiningMetric`,
  `BacktestRun`. Zero `create`/`update`/`delete`/`upsert` anywhere in `src/`
  (`hearst-connect-backend/docs/architecture.md:54-67`). The database is
  shared, never duplicated — `prisma db push`/`migrate dev` are forbidden
  here for that reason.
- Auth is service-to-service: the frontend mints a short-lived HMAC-signed
  session token (`userId`, `role`, `exp`); this backend verifies it
  (`src/auth/session.ts`), constant-time compare, fail-closed on a missing
  signing key.

## 3. Fly.dev — the fork/preprod chain (NOT the backend)

- URL: `hearst-chain.fly.dev`. chainId `31337` — a local/Anvil-style dev
  chain id, distinct from Base Sepolia (`84532`) or any mainnet id.
- Hosts `PermissionedDynaVault v2.1`, deployed at `0xA783…B146` (full
  address not published in the readiness report; truncated there).
- Purpose, stated explicitly in `docs/series1/PRODUCTION_READINESS_REPORT.md:22-25`:
  give the Series1 indexer something real to index before mainnet. It is a
  fork, not a testnet or production deployment.
- Sleeps under Fly's autosleep tier — `PRODUCTION_READINESS_REPORT.md:117-119`
  documents `codePresent:false` observed on the runtime read while indexed
  rows persisted in Postgres regardless. Indexed history is durable; live
  RPC reachability against the fork is not.
- `ContractRuntimeMode` reflects this as the literal `"v2-fork"`
  (`src/lib/backend/contracts.ts:263`), distinct from `"v2-testnet"` /
  `"v2-mainnet"` / `"not_configured"`.

## 4. Chain / contract layer

`DynaVault` event ABI (`hearst-connect-backend/src/chain/dynavault.ts`) —
14-member `VaultEventName` union mirrored in the frontend contract
(`src/lib/backend/contracts.ts:232-246`): `Deposit`, `Redeem`,
`StrategyAdded`, `StrategyRemoved`, `Rebalance`, `VaultSwapped`,
`ElectricityPaid`, `ElecPayeeUpdated`, `MonthlyElecCostUpdated`,
`MiningMetricsReported`, `CurtailmentTriggered`, `CurtailmentLifted`,
`TakeProfitExecuted`, `MonthlyEngineRun`.

Every indexed row carries: `chainId`, `contractAddress`, `blockNumber`,
`txHash`, `logIndex`, `occurredAt` (block time, legitimately nullable),
`indexedAt` (technical write time, never a substitute for `occurredAt`).
`Series1EventSummary` (`src/lib/backend/contracts.ts:558-574`) is
byte-identical to the backend's own read model
(`hearst-connect-backend/src/persistence/series1-event-repository.ts:79-95`).

What's proved on-chain today: 6 events, all `chainId 31337` (fork), 0 on any
testnet/mainnet (`hearst-connect-backend/docs/data-hygiene-series1.md:26`).

## 5. Indexer

`hearst-connect-backend/src/application/series1-indexer.ts` +
`hearst-connect-backend/docs/indexer.md`:

- **One invocation = one bounded window = exit.** No loop, no scheduler, no
  worker — continuous indexing is an explicit, not-yet-made decision
  (`indexer.md:25-26`).
- Idempotency key: `(chainId, txHash, logIndex)`, enforced by DB upsert
  (`series1-event-repository.ts:18-30`) — a replay run skips, never
  duplicates or overwrites.
- Cursor: `series1_indexer_cursors`, advanced only after the whole window
  persists (`indexer.md:20-21`).
- **Only 3 of the 14 event names get typed-column decoding**: `Deposit`,
  `Redeem`, `ElectricityPaid` (`series1-indexer.ts:127-158`). Everything
  else — including `MiningMetricsReported` — is preserved only in a raw JSON
  column with typed amount columns left `null`, never invented.
- Honesty states: `NOT_CONFIGURED` (no `DYNAVAULT_ADDRESS` — a product
  state, not an error), `UNAVAILABLE` (RPC did not answer — an outage, the
  cursor does not advance), `INDEXED` (window processed, real counts).
- **This is why the BTC monthly accumulation ledger does not exist yet**:
  the indexer that would populate `BtcAccumulationSnapshot`
  (`prisma/schema.prisma:129-143`, frontend repo — the migration creating
  this table is committed, but the reader/writer wiring for it does not
  exist in application code) needs `MiningMetricsReported` decoded with
  typed columns, and today it is not.

## 6. Database — what's real, what's seed, what's fork-marked

Per the read-only audit `hearst-connect-backend/docs/data-hygiene-series1.md`
(2026-07-22, SELECT-only, nothing modified):

| Table | Count | Classification |
|---|---|---|
| Position | 7 | 1 REAL_PRODUCTION_KEEP ($11, txHashOpen present) + 6 TEST_DATA_PURGE_CANDIDATE |
| InvestorNavSnapshot | 96 | 100% seeded (`dev_seed`/`demo_fake`/`demo_timeline`) — zero computed rows |
| MiningMetric | 424 | ADMIN_INTERNAL_KEEP — real market rows but stale since 2026-07-07 (dead cron); `uptimePct`/`deployedHashrate` are carried placeholders |
| Series1ChainEvent | 6 | CHAIN_FORK_PREPROD_KEEP — all chainId 31337, real logs of a real (fork) contract |
| Series1IndexerCursor | 1 | operational state, one cursor row |
| VaultSnapshot | 1 | seeded (`demo_seed`) — the only AUM snapshot in the base, and it is fake |
| Proof, Distribution, Subscription | 0 | empty |

No purge has executed. The purge plan exists
(`data-hygiene-series1.md:101-118`) and requires Adrien's per-group approval
before any DELETE.

## 7. Mining / operational data — two distinct sources, do not conflate

- **`MiningMetric` (DB, backend-read via `mining-repository.ts`)**:
  `takenAt`, `deployedHashrateTh` (renamed from DB column
  `deployedHashrate`), `uptimePct`, `hashprice`, `difficulty`, `btcPrice`,
  `energyCost`, `miningMarginScore`, `hashpriceTrendPct`,
  `operationalConfidence`, `alertLevel`, `summary`, `recommendation`
  (`mining-repository.ts:23-37`). Stale since 2026-07-07 — admin-grade, not
  investor-grade, until the cron is restored.
- **Live-computed hashprice (frontend, `src/lib/data/hashprice.ts`)**:
  independent of the DB — computes from mempool.space (difficulty) +
  Coingecko (BTC price) at request time. Returns `usd_per_th_day`,
  `difficulty`, `btc_price_usd`, `block_reward_btc`, `fetched_at`, `stale`.
  This is a **different pipeline** from the DB column of the same name.

What this data permits today: admin-facing telemetry tiles, qualitative
mining-state narration. What it does not yet prove: any per-period BTC
production figure (see §5 — no typed decoding of `MiningMetricsReported`),
so no monthly reserve-build KPI can be computed from it.

## 8. Oracles / external sources

| Source | What enters | Why it matters | Powers | Reliability |
|---|---|---|---|---|
| mempool.space | BTC network difficulty | live hashprice computation | B/Hashprice (live path) | external API, no SLA committed here |
| Coingecko | BTC spot price | live hashprice computation, `btcPrice` telemetry | B/Hashprice, A/Reserve valuation | external API |
| DynaVault chain reads (`src/chain/dynavault.ts`) | vault snapshot, strategies, mining metrics, electricity status, engine state | the single passage point for every on-chain fact this backend serves | C/Vault, D/Chain events | LIVE when fork/mainnet reachable, else honest `NOT_CONFIGURED`/`UNAVAILABLE` |
| Series1 indexer | decoded event log rows | the ONE producer of on-chain history — no client ever rebuilds history from fixtures again (`indexer.md:1-10`) | D/Proof family entirely | bounded-run, cursor-resumed, replay-safe |
| MiningMetric cron (currently dead) | hashprice/difficulty/btcPrice/energyCost/uptime snapshots | intended admin telemetry feed | B/Mining Economics | STALE — needs restoration, tracked as a known gap |

## 9. Proof Center — already shipped this session

`/proof-center` (frontend) now renders `Series1ProofEventStepper`
(`src/components/proof-center/series1-proof-event-stepper.tsx`), sourced
exclusively from `Series1EventSummary` via `getSeries1EventsFromBackend()`.
States: `live` (real indexed events, sorted by blockNumber/logIndex),
`empty` (genuinely no events, not an outage), `unavailable` (transport/DB
failure), `not_configured` (no indexer configured, or a rejected `SIMULATED`
envelope — simulated data is never rendered as investor-facing proof).
`chainId 31337` renders "Fork preprod"; an unexpected chain id renders
"Network mismatch" without hiding the event. Unknown event names (11 of 14
in the union) render generically rather than crashing.

## 10. Exposure classification

### Expose to B2B client
Vault status/snapshot fields, `totalAssets`, `minimumDepositAtomic`,
product term (`FactsheetTerms`), `chainId`/fork label, indexed proof events
(all `Series1EventSummary` fields), factsheet allocation targets, on-chain
allocation + drift, profile identity state, subscription eligibility, every
honest empty/unavailable state itself (the absence IS information the
client is entitled to).

### Admin only
Raw DB row counts, indexer cursor state, DB `/ready` latency, per-call-site
read failures, backend runtime report (`commitSha`, `providerMode`,
`uptimeSeconds`), chain RPC reachability (`codePresent`), full
`MiningMetric` telemetry (until re-validated as investor-grade), data
hygiene audit classifications, dev-bypass/review account existence.

### Never expose
Secrets (`SESSION_SIGNING_KEY`, `DATABASE_URL`, `KEEPER_PRIVATE_KEY`), raw
admin-bypass mechanics, full internal user emails beyond what a legitimate
admin screen needs, non-validated projections presented as facts, seed/demo
row history presented as if it were real activity.

### Not available yet
Monthly BTC accumulation ledger (§5, §7), any mainnet event (today: fork
only), audited maturity delivery actuals (no maturity has occurred),
production custody attestation (`BtcCustody.proofOfReserveAttestedAt` —
field exists, value not populated), a full BTC reserve trajectory curve (the
dashboard's own empty state already says this correctly: "No accumulation
series yet").

## 11. Next implementation steps (not started by this pass)

1. Decide whether `MiningMetricsReported` gets typed-column decoding in the
   indexer — this is the single blocking gap for the entire "reserve build
   rate" / "cost per BTC" / "maturity readiness" KPI family.
2. Restart the `MiningMetric` cron, or explicitly retire the fields that
   depend on it rather than let them silently degrade further.
3. Reconcile the two "hashprice" pipelines (DB column vs. live composite)
   before any client-facing hashprice tile ships.
4. Resolve the `hearst-connect-backend/docs/architecture.md` "not yet
   consumed" note — it is stale against this repo's actual wiring; update it
   or add a dated addendum so future readers of that repo aren't misled.
5. Confirm whether `BtcAccumulationSnapshot`'s committed migration has
   actually been applied against the live Supabase instance (source-control
   state confirmed; live-DB state was not verifiable read-only in this
   pass).
