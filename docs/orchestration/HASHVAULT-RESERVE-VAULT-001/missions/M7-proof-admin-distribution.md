# M7 — Proof Center + rail admin distribution : retrait / refonte

**Owner** : `ui-dev` + backend · **Vague** : 2 · **Dépend de** : M2 (models mining-note) ·
**Périmètre** : `src/app/admin/distributions/*`, `src/app/admin/proof*/*`,
`src/components/proof-center/*`, `src/lib/proof-center/*`, `src/lib/distribution/*` (surfaces),
`src/components/nav/product-nav-items.ts`, `src/lib/admin/overview-clusters-view.ts`

## Objectif
Retirer/refondre le rail "distribution" (page admin, nav, cluster exec, Pcap, provenance) et
matérialiser curtailment + take-profit comme **preuves attestées** dans le Proof Center.

## Contexte
Voir `02-cartography.md §D`. `src/lib/distribution/*` **models** = M2 ; ici on traite les
**surfaces** (pages, nav, proof-center, provenance). Coordonner avec M2 sur `atomic-exec`/Pcap.

## Tâches (fichier:ligne)
1. **Page admin distributions** (`src/app/admin/distributions/page.tsx`) : bâtie sur l'historique
   de distribution (`:73,68,108-114`) — retirer/refondre. La bande "accumulation model" (`:80-97`)
   est déjà correcte mais le corps reste distribution. Actions/form
   (`admin/distributions/actions.ts`, `distribution-form.tsx`) + KPI strip
   (`src/lib/admin/distributions-kpi-strip.ts`).
2. **Nav** : tab "Distributions" (`components/nav/product-nav-items.ts:131`) → retirer ou remplacer
   par "BTC Accumulation". Cluster exec "Total distributed"
   (`src/lib/admin/overview-clusters-view.ts:191,205-213`) → "BTC accumulé".
3. **Pcap / atomic-exec** : `src/lib/distribution/atomic-exec.ts` (crée la Pcap `:19,167,168`) +
   `src/lib/distribution/events.ts` (`DISTRIBUTION_EVENTS`) → coordonner avec M2 (models). Les
   surfaces qui les consomment meurent ici.
4. **Proof Center** (`components/proof-center/proof-center-hub.tsx`) : refondre le widget "Latest
   proceeds"/`RecentDistributions` (`:203`, plomberie `hub-data.ts:32,58`) en "BTC accumulé /
   settlement à maturité" (l'empty-state est déjà pivoté `:213`). **Matérialiser curtailment +
   take-profit** comme preuves attestées (badges `attested` via `provenance-badge.tsx:7`) — ils ne
   sont pas encore des preuves (dépend de M2 pour les données + M3 pour les reads on-chain).
5. **Provenance distribution** : `src/lib/proof-center/distribution-provenance.ts` (module dédié) →
   retirer ou re-cibler.
6. **Page investisseur** `/portfolio/distributions` = déjà `redirect` (M4/OK) — vérifier cohérence.

## Invariants
- **Provenance ladder** (`provenance-badge.tsx:7`) saine — réutiliser, ne pas la refaire.
- Auth admin fail-closed (`requireAdmin`) sur toute route mutante touchée.
- Honnêteté produit : une preuve curtailment/take-profit ne porte `Attested` que si réellement
  attestée on-chain ; sinon `Estimated`/`Manual`.
- Composants Catalyst uniquement.

## Gate
`pnpm typecheck && pnpm test`. Vérif browser : screenshots Adrien (Proof Center hub, admin section
remplaçant distributions). Confirmer que la nav ne pointe plus vers un rail distribution mort.

## Définition de fini
Rail distribution retiré/refondu (page, nav, cluster, Pcap surfaces) ; curtailment + take-profit
matérialisés en preuves avec provenance honnête ; widget "Latest proceeds" recadré accumulation ;
tests verts + screenshots validés.
