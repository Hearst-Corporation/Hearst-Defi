# GPU1 Migration Inventory

**PROMPT 219 — pivot GPU1.** Factual inventory of the business surfaces that must
move behind the GPU1 back-end (`gpu1-backend/`), consumed by the frontend only
through `src/lib/gpu1-client`.

Inventoried by inspecting the real repo (`find src/app/api -name route.ts`,
`ls src/lib/data`, `grep -rl "@/lib/db" src`). Counts are the **real** ones as of
this pass:

- **49** route handlers under `src/app/api/**/route.ts`.
- **40** business loaders in `src/lib/data/*.ts` (20 touch Prisma / `@/lib/db`
  directly; the rest are external-provider or pure derivation loaders).
- **213** files import `@/lib/db` across `src/` (the prompt's "161" was a stale
  estimate — the measured figure is 213).

**Migration model (strangler):** nothing has left Next.js yet. The loaders below
stay in place; GPU1 is stood up beside them and the Dashboard slice is the first
domain served end-to-end from GPU1. Every other row is `à migrer`.

Status legend: `à migrer` · `en cours (cette passe)` · `fait`.

---

## Domaine: Dashboard

| Domaine | Fichier actuel | Responsabilité | Dépendances | Destination GPU1 | Statut |
|---|---|---|---|---|---|
| Dashboard | `src/lib/data/dashboard.ts` | Aggregation of the investor dashboard (vault snapshot, capacity, position, strategies, mining, engine, recent events) | Prisma, `@/lib/agents/loaders/mining`, chain adapters | `GET /api/v1/dashboard` → `DashboardDTO` | en cours (cette passe) |
| Dashboard | `src/lib/data/portfolio-dashboard.ts` | Portfolio dashboard shaping consumed by portfolio-cockpit | derivation over portfolio + mining | folds into dashboard/portfolio GPU1 services | à migrer |
| Dashboard | `src/lib/data/portfolio-cockpit.ts` | Portfolio cockpit view assembly (HIS chart data, tiles) | portfolio-dashboard, mining-metrics, format libs | `GET /api/v1/dashboard` view models | à migrer |
| Dashboard | `src/app/api/dashboard/route.ts` | HTTP entrypoint for the dashboard payload | `src/lib/data/dashboard.ts` | proxied to GPU1 `GET /api/v1/dashboard` | en cours (cette passe) |

## Domaine: BTC

| Domaine | Fichier actuel | Responsabilité | Dépendances | Destination GPU1 | Statut |
|---|---|---|---|---|---|
| BTC | `src/lib/data/btc-price.ts` | BTC/USD spot resolution + freshness (on-chain oracle via viem) | viem (`createPublicClient`), freshness, error-tracking | `GET /api/v1/btc` → `BtcDTO` | à migrer |
| BTC | `src/lib/data/binance-price.ts` | Binance price feed | external HTTP (Binance) | GPU1 provider layer behind `/api/v1/btc` | à migrer |
| BTC | `src/lib/data/fear-greed.ts` | Fear & Greed index | external HTTP | GPU1 provider layer | à migrer |
| BTC | `src/lib/data/hashprice.ts` | Hashprice derivation | derivation over price + difficulty | GPU1 provider layer | à migrer |
| BTC | `src/app/api/btc-deposit/initiate/route.ts` | BTC deposit — initiate flow | Prisma, custody | GPU1 BTC/subscription service | à migrer |
| BTC | `src/app/api/btc-deposit/complete/route.ts` | BTC deposit — complete flow | Prisma, custody | GPU1 BTC/subscription service | à migrer |

## Domaine: Mining

| Domaine | Fichier actuel | Responsabilité | Dépendances | Destination GPU1 | Statut |
|---|---|---|---|---|---|
| Mining | `src/lib/data/mining-metrics.ts` | Derives /portfolio mining tiles from the real reported metrics | Prisma (`@/lib/db`), chart types | `GET /api/v1/mining` → `MiningDTO` (`MiningMetrics`) | à migrer |
| Mining | `src/lib/data/mining-metric-row.ts` | Single mining metric row read | Prisma | GPU1 mining service | à migrer |
| Mining | `src/lib/data/energy-cost.ts` | Energy / electricity cost | derivation | GPU1 mining service (`ElectricityStatus`) | à migrer |
| Mining | `src/app/api/mining/metrics/route.ts` | Mining metrics read endpoint | `src/lib/data/mining-metrics.ts` | `GET /api/v1/mining` | à migrer |
| Mining | `src/app/api/mining/metrics/onchain/route.ts` | On-chain mining metrics read | chain adapters | GPU1 mining service | à migrer |
| Mining | `src/app/api/mining/metrics/report/route.ts` | Report mining metrics (write) | Prisma, auth | GPU1 mining write | à migrer |
| Mining | `src/app/api/mining/electricity/route.ts` | Electricity status read | Prisma, chain | GPU1 mining service (`ElectricityStatus`) | à migrer |
| Mining | `src/app/api/mining/electricity/pay/route.ts` | Electricity payment (write) | Prisma, chain, auth | GPU1 mining write | à migrer |

## Domaine: Profile

| Domaine | Fichier actuel | Responsabilité | Dépendances | Destination GPU1 | Statut |
|---|---|---|---|---|---|
| Profile | `src/lib/data/investors.ts` | Investor identity reads | Prisma (`@/lib/db`) | `GET /api/v1/profile` → `ProfileDTO` | à migrer |
| Profile | `src/lib/data/customer-detail.ts` | Per-customer detail record | Prisma | GPU1 profile/admin service | à migrer |
| Profile | `src/app/api/auth/dev-login/route.ts` | Dev login (session mint) | auth | Connect keeps session mint; GPU1 validates token | à migrer |
| Profile | `src/app/api/auth/logout/route.ts` | Logout | auth | Connect-side | à migrer |

## Domaine: Subscription

| Domaine | Fichier actuel | Responsabilité | Dépendances | Destination GPU1 | Statut |
|---|---|---|---|---|---|
| Subscription | `src/lib/data/vaults.ts` | Canonical vault product shape (multi-vault, capacity, min-ticket) | Prisma, `@/lib/vaults/min-ticket` | `GET /api/v1/subscription` + vault services (`VaultCapacity`) | à migrer |
| Subscription | `src/lib/data/time-to-cash.ts` | Time-to-cash / lock-up derivation | derivation | GPU1 subscription service | à migrer |
| Subscription | `src/app/api/vault/route.ts` | Vault read endpoint | `src/lib/data/vaults.ts` | GPU1 vault service | à migrer |
| Subscription | `src/app/api/vault/strategies/route.ts` | Vault strategies read | chain / Prisma | GPU1 vault service (`VaultStrategy[]`) | à migrer |
| Subscription | `src/app/api/strategies/[index]/route.ts` | Single strategy read | chain / Prisma | GPU1 vault service | à migrer |
| Subscription | `src/app/api/rwa-vault/route.ts` | RWA vault read | Prisma / chain | GPU1 vault service | à migrer |
| Subscription | `src/app/api/product/factsheet/route.ts` | Product factsheet | Prisma / static | GPU1 subscription/product service | à migrer |
| Subscription | `src/app/api/rebalancing/status/route.ts` | Rebalancing status read | Prisma | GPU1 vault/engine service | à migrer |
| Subscription | `src/app/api/rebalancing/execute/route.ts` | Rebalancing execute (write) | Prisma, auth | GPU1 engine write | à migrer |

## Domaine: Admin

| Domaine | Fichier actuel | Responsabilité | Dépendances | Destination GPU1 | Statut |
|---|---|---|---|---|---|
| Admin | `src/lib/data/admin-overview.ts` | Admin overview aggregation | Prisma, custody, freshness, cache | `GET /api/v1/admin/overview` → `AdminDTO` | à migrer |
| Admin | `src/lib/data/admin-dashboard-cache.ts` | Admin dashboard cache constants | Next cache | GPU1 caching layer | à migrer |
| Admin | `src/lib/data/customers.ts` | Customers supervision (paginated) | Prisma, pagination | GPU1 admin service | à migrer |
| Admin | `src/lib/data/outreach.ts` | Outreach supervision (prospects, campaigns, funnels) | Prisma, pagination | GPU1 admin/outreach service | à migrer |
| Admin | `src/lib/data/overview-clusters.ts` | Overview clusters | Prisma | GPU1 admin service | à migrer |
| Admin | `src/lib/data/platform-totals.ts` | Platform totals | Prisma | GPU1 admin service | à migrer |
| Admin | `src/lib/data/custody.ts` / `custody-aggregate.ts` | Custody (Fireblocks) reads + aggregate | external (Fireblocks) | GPU1 admin/custody service | à migrer |
| Admin | `src/lib/data/monitoring.ts` | Monitoring reads | Prisma | GPU1 admin service | à migrer |
| Admin | `src/lib/data/cockpit.ts` | Cockpit admin data assembly | Prisma | GPU1 admin service | à migrer |
| Admin | `src/lib/data/agent-templates.ts` | Agent templates | Prisma | GPU1 admin service | à migrer |
| Admin | `src/app/api/admin/diagnostics/*/route.ts` (7) | Admin diagnostics (chat-router, guards, outreach, persistence, vault-hitl, chat-action-lab, root) | Prisma, agents, guards | GPU1 admin diagnostics | à migrer |
| Admin | `src/app/api/admin/chat-tools/route.ts` | Admin chat tools | agents | Connect chat stays; reads move to GPU1 | à migrer |
| Admin | `src/app/api/admin/product-construction/stream/route.ts` | Product construction stream | agents | Connect-side stream; data reads to GPU1 | à migrer |
| Admin | `src/app/api/admin/review-document/route.ts` | Review document | Prisma, LLM | GPU1 admin service | à migrer |
| Admin | `src/app/api/admin/review-mode/route.ts` | Review-mode | Prisma, LLM | GPU1 admin service | à migrer |
| Admin | `src/app/api/outreach/inbound/route.ts` | Outreach inbound webhook | Prisma | GPU1 outreach service | à migrer |
| Admin | `src/app/api/outreach/unsubscribe/route.ts` | Outreach unsubscribe | Prisma | GPU1 outreach service | à migrer |

## Domaine: Events

| Domaine | Fichier actuel | Responsabilité | Dépendances | Destination GPU1 | Statut |
|---|---|---|---|---|---|
| Events | `src/lib/data/timeline-snapshot.ts` | Timeline / event snapshot reads | Prisma | GPU1 v2 event indexer (`VaultEvent[]`) | à migrer |
| Events | `src/lib/data/history.ts` | Historical series | Prisma + derivation | GPU1 indexer/history service | à migrer |
| Events | `src/lib/data/vault-rebalancings.ts` | Vault rebalancing history | Prisma | GPU1 indexer | à migrer |
| Events | `src/lib/data/proofs.ts` / `proof-center.ts` | Proof center attestations | Prisma, attestation | GPU1 proof service | à migrer |
| Events | `src/app/api/inngest/route.ts` | Inngest jobs/crons entrypoint | Inngest | GPU1 workers/ | à migrer |
| Events | `src/app/api/docusign/webhook/route.ts` | DocuSign webhook | Prisma | GPU1 events/webhooks | à migrer |
| Events | `src/app/api/hubspot/webhook/route.ts` | HubSpot webhook | Prisma, HubSpot | GPU1 events/webhooks | à migrer |
| Events | `src/app/api/sumsub/webhook/route.ts` | Sumsub (KYC) webhook | Prisma | GPU1 events/webhooks | à migrer |
| Events | `src/app/api/typeform/webhook/route.ts` | Typeform webhook | Prisma | GPU1 events/webhooks | à migrer |
| Events | `src/app/api/resend/webhook/route.ts` | Resend (email) webhook | Prisma | GPU1 events/webhooks | à migrer |

## Cross-cutting (stay in Connect)

| Domaine | Fichier actuel | Responsabilité | Dépendances | Destination GPU1 | Statut |
|---|---|---|---|---|---|
| Chat | `src/app/api/cockpit-chat/route.ts`, `cockpit-chats/*`, `chat-nav`, `agent-canvas/[canvasId]` | LP Master Agent / cockpit chat (single engine, ADR-017) | OpenAI, agents | stays in Connect; reads bounded tools call GPU1 | à migrer (reads only) |
| Health | `src/app/api/health/route.ts`, `health/deep/route.ts` | Liveness / deep health | Prisma, providers | GPU1 exposes its own `/health` `/ready` | à migrer |
| Search | `src/app/api/search/route.ts` | Global search | Prisma | GPU1 read service | à migrer |
| Document Vault | `src/app/api/document-vault/**` (5) | Document vault reads/writes + agent plan/create | Prisma, Storage, agents | GPU1 document service | à migrer |
