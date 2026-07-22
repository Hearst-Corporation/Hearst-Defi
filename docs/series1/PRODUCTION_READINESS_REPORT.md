# Series 1 — Production Readiness Report

Date: 2026-07-23 · Orchestration loop of PROMPT 010, executed on top of the
closed data-truth chain (front `61a0130a…c0d6addf`, backend `7cf84d9…7776176`).
Every claim below is backed by an executed gate or a live probe; nothing is
"seems fine".

## 1. Architecture finale

- **Frontend** (this repo, port 4105, Vercel prod = app.hearst.app):
  Next.js 16, investor pages under `src/app/(product)/`. Data reaches pages
  through per-page loaders (`_data/*-loader.ts`) that call the backend HTTP
  client (`src/lib/backend/server-client.ts`) — `/dashboard`, `/vaults`,
  `/profile`, `/proof-center` are backend-fed. `/portfolio`, `/vaults/[id]`
  and admin still read Prisma/chain directly (deliberate, unopened worksite —
  see §8).
- **Backend** (`hearst-connect-backend`, GPU1 container, port 3901, public
  via cloudflared at `connect-api.hearst.app`): node:http route table,
  `Envelope<T>` + `Resolved<T>` honesty envelopes, HMAC bearer sessions,
  fail-closed auth on every data route, keeper POSTs guarded (admin +
  kill-switch + rate limit).
- **Chain**: DynaVault v2 on a preprod fork (`chainId 31337`,
  vault `0xA783…B146`). The Series 1 event indexer (bounded runs, cursor
  resume, DB-level idempotence on `(chainId, txHash, logIndex)`) is the ONE
  producer of on-chain history; 6 real events indexed and replay-proven.
- **DB**: single Supabase prod (pooler). Purged of all seed data on
  2026-07-23 (APPROVAL 002 — 411 rows; dump + JSON exports retained).

## 2. Front final (this loop's changes)

| Commit | Content |
|---|---|
| `ad6a7ec2` | Proof Center consumes `/api/v1/series1/events`: real indexed counts + last tx per register entry, fork provenance labelled ("Indexed on fork (chain 31337) — not mainnet"), indexer outage rendered as a distinct *unreachable* state (never a silent fallback), `/proof-center/full` drill-down finally linked from its parent. Contract drifts closed: `v2-fork` added to `ContractRuntimeMode`, `BacktestRunSummary` re-mirrored on the real backend shape, `Series1EventSummary`/`Series1EventsDTO` + `getSeries1EventsFromBackend` added. |
| `49cd9a7a` | Position detail maturity anchored on the real 24-month term (was soft lock-up 60d / invented now+365d); APY-derived USD range mislabelled "Est. BTC delivery" replaced by an honest not-yet-reported state; `/vaults` gains the missing primary "View & subscribe" CTA (the invest funnel had **no inbound link**); no-wallet and KYC dead-ends now CTA into onboarding; hard-coded `#a7fb90` replaced by `--ct-accent` tokens. |
| `c0d6addf` | Structural source allowlists on every snapshot reader (see §4). |

## 3. Backend final

- `7776176` (deployed): the events read model now exposes `chainId` and
  `contractAddress` — the uniqueness dimension is no longer hidden at read
  time, so consumers can badge fork rows and build explorer links.
- Contracts live and probed post-deploy: `/api/v1/profile` (identity-only,
  PARTIAL `no_investor_record` honest), `/api/v1/dashboard`
  (vault LIVE `totalAssets 127000000000`, `minimumDepositAtomic
  250000000000` byte-identical to the factsheet), `/api/v1/series1/events`
  (LIVE, chainId present).

## 4. Data truth final

- All client-facing fixtures, synthetic series and fake numbers purged in
  the prior chain (front `eb7a064b` and earlier) — **not reopened**, still
  guarded by `no-fixture-chain.test.ts`.
- DB seeds physically removed (APPROVAL 002). This loop added the missing
  **structural** guard: `snapshot-sources.ts` allowlists only sources with a
  verified real writer (`live` custody cron, `backfill` canonical history)
  for `VaultSnapshot`, and `computed` for `InvestorNavSnapshot`. A reappeared
  `demo_seed`/`daily-seed` row can no longer be served as real state, and the
  custody cron no longer launders demo provenance into `"live"` nor invents
  zero scores — it skips with a reason.
- Honesty states verified end to end: UNAVAILABLE (outage) vs NOT_CONFIGURED
  (absence) vs ERROR (transport) remain distinct through
  `toUiStatus`/`resolvedToWired` (Agent B audit, confirmed in code).

## 5. Design system final

- No DS tokens were edited this loop (per standing rule). One violation
  fixed: the hard-coded accent hex on /portfolio.
- **Known, deliberate debt (not fixed here):** the investor journey spans
  two visual systems — `series1-shell` (zinc, light-first) on
  /vaults·/portfolio·/proof-center·/profile vs the `--ct-*` bento cockpit on
  /dashboard·/invest·/portfolio/[id], plus the `kyc-page` band on
  /vaults/[id]. Unifying this is a visual refonte requiring Adrien's
  screen-by-screen validation — parked as the next dedicated pass, not
  smuggled into an orchestration loop.

## 6. Tests

- Backend: `pnpm run check` → **84/84 tests + tsc, green** (post-change).
- Front: `tsc --noEmit` green; `PRISMA_SQLITE_ISOLATED=1 pnpm test` →
  **4539/4539 tests green** (4 new: snapshot allowlist pins, custody skip
  path, events contract shape).
- gitleaks pre-commit clean on all three front commits.

## 7. Runtime

Probed live after deploy (2026-07-23):

- Container `hearst-connect-backend-app` healthy on GPU1, port 3901,
  `/health` ok, `/ready` `db:"ok"` (~1s pooler latency).
- `/api/v1/runtime` reports `commitSha 7776176…`, `providerMode
  gpu1-supabase`, `mode v2-fork chainId 31337`.
- Public path `connect-api.hearst.app`: profile 200, dashboard vault LIVE,
  events LIVE with `chainId: 31337` in each row.
- Frontend dev (4105): pages respond (307 auth redirect without session —
  correct fail-closed behaviour); rendered visuals await Adrien's screenshot
  validation (standing rule: no agent-driven browser).

## 8. Risques restants (ranked)

1. **P2 — Split visual system** (§5): premium-cockpit perception blocked
   until the shell unification pass runs.
2. **P2 — `/vaults/[id]`, `/portfolio`, invest `confirmed` still read
   Prisma/chain directly**: two sources of truth for NAV depending on the
   page visited; "24 months" literal on /vaults/[id]. Migration to the
   backend factsheet is the natural next data pass.
3. **P2 — dashboard `ops` block hard-coded not_supported** while
   /proof-center reads and shows the same ops state — inter-page
   inconsistency; `BtcDTO.production.monthly` (real series) still not
   charted on the dashboard.
4. **P2 — webhook `console.error(err)`** (sumsub/typeform/resend) may log
   payload fragments; move to the pseudonymising logger.
5. **P3 — dead exports**: `getStrategyFromBackend`/`getRwaVaultFromBackend`/
   `getRebalancingStatusFromBackend`/`getBacktestHistoricalFromBackend`
   unconsumed; `placeholderStatus`, `Series1ChartPlaceholder` orphaned;
   `POLICY_TARGET_BPS` duplicated (2 sites); distribution-era fields still
   computed in `lib/data/portfolio.ts`.
6. **P3 — fork is ephemeral** (`hearst-chain.fly.dev` sleeps; runtime showed
   `codePresent:false` while indexed rows persist) — indexed history is
   durable, live reads are not, until Base Sepolia/mainnet.
7. **Ops** — MiningMetric series stale since 2026-07-07 (dead cron, known);
   GHCR-published images report `commitSha:null` (documented CI gap);
   in-memory rate limiter is single-process by design.

## 9. Décisions produit (standing, from Adrien)

- Maturity = 24-month term, BTC delivered at maturity, **no periodic
  distributions, no promised APY** — now consistent down to the projection
  horizon.
- DÉCISION 002: the two Gmail accounts = KEEP/REVIEW (no purge without human
  validation); the three `@hearst.local` accounts = KEEP until the
  dev-bypass is replaced by an explicit local-only config.
- chainId 31337 events = KEEP, always labelled as fork, never presented as
  mainnet (now enforced in the Proof Center rendering).
- Vault naming arbitration, fixture purge, DB purge: **closed, do not
  reopen**.

## 10. GO LIVE verdict

**GO for the current scope — preprod-fork Series 1 cockpit.** All gates
green, no fake data path remains, provenance is structural, the invest
funnel is reachable, and the deployed runtime self-reports the shipped SHA.

**NOT yet GO for mainnet capital**: that requires (a) the contract on a
real network with the indexer pointed at it, (b) the visual-shell
unification pass validated by Adrien, (c) the remaining Prisma-direct pages
migrated to the backend contract. None of these are regressions — they are
the explicitly-scoped next passes in §8.
