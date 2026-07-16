# Backend integration — gpu1-backend (mission HC-BTC-021 cartography, 2026-07-17)

Read this before wiring any product screen onto `gpu1-backend` (workspace
package at repo root, not a Next.js app). Full detail:
`gpu1-backend/docs/architecture.md`, `gpu1-backend/docs/data-sources.md`.

## Current state — nothing is wired yet

`src/features/investor-ui/data-source/index.ts`'s `getInvestorUiDataSource()`
always returns `FixtureInvestorUiDataSource`. `/btc`, `/dashboard`, `/mining`
run on 100% local fixtures — zero DB access, zero network call, zero secret.
This was verified by direct code reading and by two passing architecture
guard tests (`src/features/investor-ui/__tests__/architecture-guard.test.ts`,
`src/lib/chain/__tests__/no-client-chain-access.test.ts`).

The rest of the investor product (`/portfolio`, `/vaults`, `/profile`,
`/proof-center`) and all of `/admin/**` already read live data — but via
direct server-side Prisma access from Next.js (`src/lib/data/*`), not via
`gpu1-backend`. That is a separate, pre-existing pattern this pass did not
change.

## What exists to consume gpu1-backend, unused today

`src/lib/gpu1-client/*` — a typed HTTP client (`client.ts`, `dashboard.ts`,
`btc.ts`, `mining.ts`, `admin.ts`, `profile.ts`, `subscription.ts`,
`mint-token.ts`, `errors.ts`, `schemas.ts`). Its only caller is
`src/features/investor-ui/data-source/gpu1-data-source.ts`
(`Gpu1InvestorUiDataSource`), which is never instantiated by the factory
above — every method currently `throw`s `NOT_WIRED_MESSAGE`.

## Why this pass did not flip the switch

1. `gpu1-backend` was not deployable before this pass (no Dockerfile, no
   CI/CD — now added, see `gpu1-backend/docs/deployment.md`).
2. A dual-read path exists on the same DB tables (`src/lib/data/*` on the
   frontend, `gpu1-backend/src/persistence/*` on the new service) — both are
   read-only and safe today, but wiring `/btc` onto `Gpu1InvestorUiDataSource`
   while the DynaVault v2 contract is undeployed would turn a page that
   today renders honestly (fixtures, `?state=` previews) into one that
   crashes every request with a `500` (`Gpu1InvestorUiDataSource` throws by
   design — "no silent fallback"). That's a regression on a page the mission
   was asked not to break.
3. All financial mutations (subscribe, redeem, rebalancing execute) still
   live in Next.js Server Actions with direct Prisma writes — moving reads to
   gpu1-backend ahead of moving writes is fine (same DB), but confirming that
   end-to-end was out of scope for this cartography + deployability pass.

## How to wire a screen once ready (for the next pass)

1. Deploy `gpu1-backend` for real (`docs/deployment.md` in that package —
   Dockerfile + CI exist now; the GPU1 host `.env` and cloudflared route
   still need to be created by hand, first time).
2. Implement the token-minting side in Connect (`src/lib/gpu1-client/mint-token.ts`
   exists but must be checked against `gpu1-backend/src/auth/session.ts`'s
   expected payload shape before relying on it).
3. Flip `getInvestorUiDataSource()` in `src/features/investor-ui/data-source/index.ts`
   to return `Gpu1InvestorUiDataSource` — this is the single documented
   switch point; never instantiate `Fixture`/`Gpu1` data sources ad hoc in a
   page.
4. Confirm the DTO shapes returned by `gpu1-backend`'s routes match what each
   page currently expects from the fixture shape (`BtcViewModel`,
   `DashboardViewModel`, `MiningViewModel`) — they are documented as
   "structurally close but not identical" in `gpu1-data-source.ts`'s header;
   the mapping belongs in that file, never inlined in a page.
5. Re-run the architecture guard tests — they must still pass with the real
   source wired in (they currently assert fixture-only behavior for these
   three screens; check whether they need updating once a live source is
   allowed).

## No cross-project imports

Per this repo's `CLAUDE.md` §11, nothing here was copied from any sibling
repo (including `hearst-connect` read-only reference) — `gpu1-backend`'s code
predates this pass and was recoded/extended in place, not imported.
