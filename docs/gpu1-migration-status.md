# GPU1 Migration Status — strangler plan (M1 → M10)

**PROMPT 219 — pivot GPU1.** Hearst Connect's business back-end is being moved into
a physically separate service, `gpu1-backend/`, deployed on GPU1. The frontend
(Client **and** Server Components, Server Actions, Route Handlers) consumes it
**only** through `src/lib/gpu1-client` — never Prisma / Supabase / RPC / providers
directly.

This is a **strangler** migration: the new service is stood up *beside* the
existing loaders, one domain at a time. Nothing is ripped out until its GPU1
replacement is live and proven.

## What has left Next.js

**Nothing yet.** Every loader in `src/lib/data/*` and every handler in
`src/app/api/**` still runs inside the Next.js app. The Dashboard domain is the
first to be served end-to-end from GPU1; during the transition the Next dashboard
route proxies to GPU1 rather than being deleted, so a regression is one env flip
away from rollback.

## What runs on GPU1 today

The new `gpu1-backend/` service (Fastify + Prisma + Zod, Node 22). This pass it
carries:

- The runtime (`/health`, `/ready`, `/api/v1/runtime`).
- The canonical domain contract (`gpu1-backend/src/domain`) — shared by the API
  and the frontend client (`src/lib/gpu1-client/schemas.ts` re-exports it).
- Supabase access from GPU1 via the **same** prod pooler as Connect (no second
  DB — `gpu1-backend/src/persistence/prisma.ts`).
- The auth boundary (validates a Connect-minted signed session; never trusts a
  role asserted by the frontend).
- `GET /api/v1/dashboard` returning `DashboardDTO` end-to-end.

## Milestones

| Milestone | Scope | État |
|---|---|---|
| **M1 — Runtime** | Fastify service on GPU1, `/health` `/ready` `/api/v1/runtime`, container + Caddy + cloudflared via the `gpu1-defi` runner, Supabase reuse (same pooler). | **fait (cette passe)** |
| **M2 — Auth boundary** | Service-to-service session: Connect mints a signed token, GPU1 validates it (`SESSION_SIGNING_KEY`) and derives the role itself. Never trust a client-asserted role. | **amorcé (cette passe)** |
| **M3 — Dashboard** | `dashboard.ts` + `portfolio-dashboard.ts` + `portfolio-cockpit.ts` → `GET /api/v1/dashboard` (`DashboardDTO`); frontend reads via `getDashboard()`; Next route proxies. | **end-to-end (cette passe)** |
| **M4 — BTC** | `btc-price.ts`, `binance-price.ts`, `fear-greed.ts`, `hashprice.ts`, BTC deposit flows → `GET /api/v1/btc` (`BtcDTO`). Provider layer moves off the frontend. | à venir |
| **M5 — Mining** | `mining-metrics.ts`, `mining-metric-row.ts`, `energy-cost.ts`, mining metrics/electricity endpoints → `GET /api/v1/mining` (`MiningDTO`). | à venir |
| **M6 — Profile** | `investors.ts`, `customer-detail.ts`, auth session reads → `GET /api/v1/profile` (`ProfileDTO`). | à venir |
| **M7 — Subscription / Vault** | `vaults.ts`, `time-to-cash.ts`, vault/strategies/rebalancing/factsheet endpoints → `GET /api/v1/subscription` + vault services (`VaultCapacity`, `VaultStrategy[]`). | à venir |
| **M8 — Admin** | `admin-overview.ts`, `customers.ts`, `outreach.ts`, custody, monitoring, admin diagnostics endpoints → `GET /api/v1/admin/*` (`AdminDTO`). | à venir |
| **M9 — Events / indexer** | `timeline-snapshot.ts`, `history.ts`, `vault-rebalancings.ts`, proofs, webhooks (docusign/hubspot/sumsub/typeform/resend), Inngest → GPU1 `indexers/` + `workers/` + `VaultEvent[]`. v2 contract not deployed → runtime status `not_configured` until then. | à venir |
| **M10 — Cutover** | Remove the Next.js proxy shims and the migrated `src/lib/data/*` loaders once every domain is live and stable on GPU1; the frontend talks only to `src/lib/gpu1-client`. | à venir |

## Rollback posture

Each migrated domain keeps its Next.js loader in place behind a proxy until M10.
A GPU1 outage or regression is reverted by flipping the route back to the local
loader — no data loss, because GPU1 reads the **same** canonical Supabase DB.

## Related docs

- `docs/gpu1-migration-inventory.md` — the per-file inventory (loaders, routes,
  domains, destinations).
- `docs/gpu1-backend-architecture.md` — target architecture, stack, deploy chain,
  auth model.
- `gpu1-backend/README.md` — service-level status.
