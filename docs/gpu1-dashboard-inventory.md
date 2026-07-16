# Dashboard inventory — portfolio/page.tsx → GPU1 DTO (PROMPT 223 §5)

Matrice de tous les blocs affichés par `src/app/(product)/portfolio/page.tsx` (le
Dashboard investisseur réel), leur source Next.js actuelle, et leur cible GPU1.

Source actuelle unique : `loadPortfolioCockpit()` (`src/lib/data/portfolio-cockpit.ts`,
Prisma direct) + `loadVaultRebalancings()` + `loadMachineMarket()` + `getSession()`.

| Bloc | Source Next.js actuelle | Calcul métier | Cible DTO GPU1 | Provenance | Migration |
|---|---|---|---|---|---|
| Identité investisseur | `getSession()` + Investor (Prisma) | — | `identity` | db (LIVE) | GPU1 repo |
| Position (deposit/accrued/value) | Position (Prisma, Decimal) | somme positions | `position` | db (LIVE) | GPU1 repo |
| Shares | — (on-chain) | — | `position.shares` | **NOT_CONFIGURED** | contrat v2 |
| NAV series | InvestorNavSnapshot (Prisma) | courbe gardée | `performance.navPoints` | db (LIVE/PARTIAL) | GPU1 repo |
| Take-profit progress | Position | accrued/(deposit×0.24) | `position` dérivé | db (LIVE) | GPU1 service |
| Pockets B1/B2/B3 | constantes produit | target 40/27/33 | `allocation` | **manual (LIVE)** | constantes |
| Allocation réelle (drift) | — (on-chain) | — | `allocation.actualBps` | **NOT_CONFIGURED** | contrat v2 |
| Capacity / TVL cap | — (on-chain) | max(cap−assets,0) | `capacity` | **NOT_CONFIGURED** | contrat v2 |
| Souscription | Investor + constantes | éligibilité | `subscription` | db + manual | GPU1 service |
| Réserve BTC | — (on-chain) | — | `reserve` | **NOT_CONFIGURED** | contrat v2 |
| Mining production/uptime | MiningMetric (Prisma) ou PILOT | — | `mining` | db (LIVE) si ligne réelle | GPU1 repo |
| Distributions | Distribution (Prisma) | v2 = accumulation | `distributions` | db (souvent vide) | GPU1 repo |
| Rebalancing feed | `loadVaultRebalancings()` (Prisma) | — | `rebalancing` | **NOT_CONFIGURED** | contrat v2 |
| Machine market | `loadMachineMarket()` (Telegram read) | — | `machineMarket` | db/provider | GPU1 (lot suivant) |
| Activité | InvestorTransaction (Prisma) | — | `activity` | db (LIVE/PARTIAL) | GPU1 repo |
| Alertes | dérivées | — | `alerts` | derived | GPU1 service |
| KYC / whitelist | Investor.kycStatus / on-chain | — | `identity` | db + NOT_CONFIGURED | GPU1 repo |
| Preuves | proof loaders (Prisma) | — | `proofs` | db | GPU1 (lot suivant) |
| AI Experts | — | contexte | `aiExperts` | GPU1 ai-context | GPU1 |
| Risk dimensions / signals | PILOT fixtures | — | (déféré) | pilot | non-migré (PILOT) |
| Projection fan | PILOT seeded | seed | (déféré) | pilot | non-migré (PILOT) |
| Exit paths | dérivé | — | (déféré) | derived | lot suivant |

## Règles de provenance appliquées

- **db (LIVE)** : lu depuis Supabase via le repository GPU1 → valeur réelle.
- **manual (LIVE)** : constante produit (allocations 40/27/33, terme 24 mois, APY
  range) — c'est une vraie donnée fixée, pas fabriquée.
- **NOT_CONFIGURED** : dépend du contrat v2 non déployé → `value:null`, jamais 0.
- **PILOT** : fixtures de démonstration explicitement marquées — ne PAS présenter
  comme LIVE ; à re-décider avant migration (probable retrait ou badge pilot).

## Statut migration

Le DTO GPU1 est **enrichi** pour porter les blocs db-backed + constantes (voir
`gpu1-backend/src/application/dashboard.ts`). La **bascule de la page** reste
bloquée par l'edge public `connect-api.hearst.app` (502, cf.
`gpu1-deployment-runbook.md`). Sans edge joignable, brancher la page casserait la
prod — non fait.
