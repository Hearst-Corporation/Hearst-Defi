# Backend integration — Series 1 contract parity

Status: M16 snapshot, 2026-07-22, frontend base `052268b2`.

The product backend is the independent `hearst-connect-backend` service. The
frontend calls it over HTTP through `src/lib/backend/*`; it must never import
backend source code or recreate `gpu1-backend` inside this repository. The
production hostname is expected to be supplied through deployment environment
configuration (currently referred to as `connect-api.hearst.app`); this
repository does not prove which URL is configured in production.

## Authority and failure contract

- `BACKEND_INTERNAL_URL` is preferred server-side.
- `NEXT_PUBLIC_BACKEND_URL` is the non-secret public base URL fallback.
- Local development falls back to `http://localhost:3900`.
- `BACKEND_SESSION_SIGNING_KEY` signs a 120-second server-only HMAC token.
- `src/lib/backend/client.ts` performs one retry for transient network,
  timeout, or 5xx failures.
- There is no Prisma or fixture fallback after a backend failure.
- A failed backend request must render `backend_down`, `unavailable`,
  `not_configured`, or another explicit honest state.
- `?state=` fixtures are permitted only as explicit QA previews and must remain
  visibly simulated.

There is no supported data-source rollback flag today.
`getInvestorUiDataSource()` is hard-wired to
`BackendInvestorUiDataSource`. Operational rollback means reverting a release
or serving an honest unavailable state; it must not silently switch an
investor route back to Prisma or fixtures.

## Current route/source map

### Phase A — backend transport is present

| Route | Current source | Classification | Known parity debt |
|---|---|---|---|
| `/dashboard` | `/api/v1/dashboard`, `/api/v1/mining`, `/api/v1/btc` through `BackendInvestorUiDataSource` | Hybrid | The accumulation series still reads `btcPageExtraCompleteFixture.production` in the default path. |
| `/btc` | `/api/v1/btc`, `/api/v1/mining`, `/api/v1/dashboard`; local mapping only | Backend | No silent runtime fallback found. Explicit `?state=` remains fixture-backed. |
| `/btc/ledger` | `/api/v1/btc` through `getBtcPageData` | Hybrid | Mining term/month values always come from `getFixtureInvestorUiDataSource`, including the default path. |
| `/mining` | `/api/v1/mining` through `BackendInvestorUiDataSource` | Backend with presentation debt | The default live path still renders a `simulated` header badge. |

The route-level backend-down behavior exists for `/dashboard`, `/btc`,
`/btc/ledger`, and `/mining`. The three Phase A page trees are guarded against
direct Prisma, chain-provider, Supabase, and external-fetch imports by
`src/features/investor-ui/__tests__/architecture-guard.test.ts`.

### Phase B — Series 1 investor reads still owned by Next.js

| Route | Direct source today | Required backend boundary |
|---|---|---|
| `/portfolio` | Prisma loaders in `src/lib/data/portfolio-*`, Prisma mining metrics and rebalancings, direct Telegram market read, labelled pilot fixtures | Position summary, BTC accumulation, reserve events, mining operations and honest source status. |
| `/portfolio/[positionId]` | Prisma `loadPosition`, pure projection engine, chain explorer formatting | Position detail plus Series 1 event histories; projection remains a separately versioned derived block. |
| `/portfolio/activity`, `/portfolio/tax`, `/my-vaults` | Prisma portfolio loaders; tax also calls the pure engine | Portfolio ledger/history DTOs with backend-owned authorization. |
| `/vaults`, `/vaults/[id]`, `/vaults/[id]/invest` | Prisma `VaultDeployment`/`VaultSnapshot` through `src/lib/data/vaults.ts` | Vault catalogue/detail/subscription terms. DB failure must not be indistinguishable from an empty catalogue. |
| `/vaults/[id]/invest/confirmed` | Prisma position lookup plus direct chain reads | Confirmation/receipt DTO; chain and indexer freshness belong in backend metadata. |
| `/proof-center` | Direct event-logger and PoR chain reads, direct Fireblocks custody call, Prisma proof/distribution/rebalance counts, coverage loader | Unified evidence DTO for mining, reserves, custody, delivery, contract events and freshness. |
| `/proof-center/full` | Direct chain reads, Fireblocks, Prisma proofs and governance proposals | Paginated evidence/event log with item-level provenance and freshness. |
| `/profile` | `PrismaProfileDataSource` | Profile endpoint is absent; `BackendInvestorUiDataSource.getProfile()` currently throws. |

`/admin/**` remains predominantly Next.js + Prisma/data loaders and Server
Actions. That is outside the Phase B investor-read cutover. Financial and
administrative writes also remain outside the external backend contract and
must be migrated under a separate mutation/auth mission, never incidentally
during a read-parity pass.

## Contract implemented in this frontend

`src/lib/backend/contracts.ts` is a local TypeScript record of the external
contract, not a runtime import from the backend repository.

Every endpoint currently returns:

```text
Envelope<T> = {
  data: T,
  meta: {
    status,
    source,
    generatedAt,
    freshnessSeconds,
    version: "v1",
    reason
  }
}
```

Every independently sourced block must use `Resolved<T>` with:

- `status`: `LIVE`, `STALE`, `PARTIAL`, `UNAVAILABLE`,
  `NOT_CONFIGURED`, `NOT_SUPPORTED`, or `PERMISSION_DENIED`;
- `value`: nullable, never a fabricated placeholder;
- `provenance`: `live`, `db`, `indexed`, `manual`, or `fixture`;
- `freshness`: `asOf`, `ageSeconds`, `stale`;
- optional machine-readable `reason`.

Current top-level DTOs:

- `DashboardDTO`: identity, position, activity, proofs, allocation,
  subscription, alerts, capacity, reserve, mining, performance, engine,
  strategies and recent events. Its `distributions` block is legacy and must
  not become the Series 1 delivery model.
- `BtcDTO`: reserve, B2 exposure, BTC produced, take-profit tiers, generic
  vault events, attribution, production series, custody and proof references.
- `MiningDTO`: hashrate, BTC earned, electricity, curtailment/engine state and
  operational telemetry.

## Series 1 contract still required

The endpoint path and pagination scheme for Phase B are not defined in this
repository. They must be agreed with the external backend before a frontend
loader is added. The domain payload must cover the following blocks.

### BTC accumulation snapshots

Mirror the M13 `BtcAccumulationSnapshot` facts:

- `id`, `vaultDeploymentId`, optional `monthIndex`;
- `hashrateTh`, `btcEarnedSats`, `totalBtcEarnedSats`;
- `reportedAt`, optional `txHash`, optional `blockNumber`, `source`.

### Curtailment events

Mirror `CurtailmentEvent`:

- `id`, `vaultDeploymentId`, `kind` (`triggered` or `lifted`);
- `monthIndex`, `btcPriceUsd`, optional `thresholdUsd`;
- `occurredAt`, optional `txHash`, optional `blockNumber`, `source`.

### Take-profit executions

Mirror `TakeProfitExecution`:

- `id`, `vaultDeploymentId`, `tierIndex`, optional `monthIndex`;
- `btcPriceUsd`, `btcSoldSats`, `usdcReceived`;
- `executedAt`, optional `txHash`, optional `blockNumber`, `source`.

### Proof, reserve and delivery evidence

- proof-of-mining, proof-of-reserves and custody references;
- reserve/take-profit/curtailment contract events;
- evidence identity, source timestamp, transaction/block identity when
  on-chain, and item-level provenance;
- delivery events only after maturity settlement evidence exists.

Delivery must not reuse the legacy `Distribution` DTO or infer a delivery from
a zero/absent distribution row. A canonical delivery persistence/event source
does not yet exist in the frontend schema, so its exact payload remains a
backend/product decision rather than an invented frontend type.

For JSON transport, Prisma `BigInt` and `Decimal` values must be decimal
strings; timestamps must be ISO-8601 strings. Each list must itself be wrapped
in `Resolved<T>` so an empty list, an unavailable source, and an unconfigured
indexer remain distinguishable.

## Verified contract gaps

1. `backendFetch<T>()` casts JSON to `T`; there is no runtime DTO validation.
2. The optional live contract test checks top-level keys only. When no backend
   answers its single health probe, test bodies return early; a green local run
   is not proof of live parity.
3. No versioned OpenAPI/JSON Schema artifact is consumed by this frontend.
4. `DashboardDTO.distributions` is legacy; delivery/reserve event blocks are
   absent.
5. Dedicated accumulation, curtailment and take-profit history DTOs are absent;
   generic `VaultEvent` loses Series 1 quantitative fields.
6. The `/dashboard`, `/btc/ledger`, and `/mining` presentation debts listed
   above keep Phase A from being fully converged.
7. Backend URL/signing variables are read directly from `process.env`, not
   validated by `src/lib/env.ts`.
8. There is no backend profile endpoint and no supported rollback flag.

## Strangler sequence

### Phase A — harden the existing cutover

1. Remove the default-path fixture from `/dashboard`.
2. Use backend mining term data on `/btc/ledger`.
3. Derive `/mining` provenance badge from the resolved backend status.
4. Add runtime response validation and an opt-in CI contract job against a
   pinned backend contract version.

These are runtime fixes and must be separate missions with their own locks.

### Phase B — move critical Series 1 reads

1. Proof Center: define the evidence endpoint and consume M13 accumulation,
   curtailment and take-profit histories.
2. `/portfolio/[positionId]`, then `/portfolio`: move position/event reads
   behind backend DTO adapters.
3. `/vaults/[id]`, `/vaults`, then investment confirmation: move catalogue,
   terms and receipt reads.
4. `/profile` and secondary portfolio routes.

Each route switches atomically: backend response or honest unavailable state.
Do not perform a per-request live dual read and do not fall back to Prisma.
Parity comparison belongs in deterministic adapter fixtures or an explicit
operator-run contract check.

### Phase C — remove investor direct reads

- fail an architecture guard when investor route graphs import `@/lib/db`,
  `@/lib/data/*`, direct custody providers or direct chain readers;
- delete superseded frontend loaders only after every consumer moves;
- migrate mutations/auth separately;
- retain admin/history access until its own backend ownership is approved.

## Existing targeted gates

- `src/features/investor-ui/__tests__/no-default-fixture.test.ts`
- `src/features/investor-ui/__tests__/architecture-guard.test.ts`
- `src/app/(product)/dashboard/__tests__/backend-down.test.tsx`
- `src/lib/backend/__tests__/contract.test.ts` (optional live endpoint)

No external backend source, production environment, database, migration or
deployment is modified by this plan.
