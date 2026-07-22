# M1 — Engine : purge yield/APY, companion Monte-Carlo BTC-accumulation

**Owner** : `engine-dev` · **Vague** : 1 · **Dépend de** : — · **Périmètre** : `src/lib/engine/*` (+ `__tests__`)

## Objectif
Aligner le moteur de projection sur le modèle Series 1 (BTC accumulation, range en BTC, aucun
APY promis), sans casser la pureté #6 (déjà intacte) ni le cœur déjà pivoté
(`mining-note-projection.ts`).

## Contexte
Le cœur v3.0 est fait et pur. Restent des surfaces yield/APY et un Monte-Carlo qui sort de l'APY
au lieu du BTC accumulé. Voir `02-cartography.md §B`.

## Tâches (fichier:ligne)
1. **`vaults.ts`** — purger le vocabulaire yield : renommer `ApyTargetRange` (`:41`) →
   range-BTC-accumulé ; retirer le littéral `apyTarget:{8,15}` (`:100`) ; reconsidérer ticker/label
   "Hearst Yield Vault"/"HYV" (`:96-97`) — **coordonner avec M9** si rebrand décidé, sinon laisser
   le wordmark et ne changer que la sémantique APY→BTC.
2. **`VAULT_DEFENSIVE` (`:124-146`) + `VAULT_BTC_PLUS` (`:149-171`)** — full ancien modèle
   (bandes APY, 4 sleeves). Défaut Q1 : **retirer de Series 1** (Series 1 = un seul vault) ; garder
   en config morte seulement si le produit à levier distinct les réclame (décision #2).
3. **`monte-carlo.ts`** — écrire un **companion seedé** produisant une **RANGE de BTC accumulé**
   (pas APY), parallèle à `runMiningNoteProjection`. Le champ `seed` est déjà réservé
   (`mining-note-types.ts:90-95`). Ne pas casser le MC APY historique (v2.0, ADR-006 immuable) —
   c'est un **ajout**, pas un remplacement.
4. **`projection.ts`** — `projectVaultApy` reste pour l'outillage admin (draft, Q2) ; **ne pas**
   le brancher aux surfaces Series 1. Documenter en tête qu'il est hors-Series-1.
5. **`coverage.ts` / `distribution-policy.ts` / `coverage-view.ts`** — modèle distribution cash.
   `distribution-policy.ts` (`DistributionAction`) est réutilisable comme "reserve health" mais le
   vocabulaire "distribution" doit être refondu. Coordonner avec M7 (qui consomme coverage-view en
   Proof Center). Défaut : recadrer, pas supprimer (la logique coverage sert la santé électricité).
6. **`rebalancing-rules.ts:234-256`** — réécrire les strings "APY range … distribution cadence"
   en langage BTC-accumulation.
7. **`methodology.ts:29-42`** — convertir/retirer `STRESSED_APY_BAND` / `STRESSED_APY_POINT_HALF_BAND`.

## Invariants (ne pas violer)
- **Pureté #6** : aucun `Math.random`/`Date.now`/`fetch`/`prisma`/`fs`/`process.env` introduit.
  Clocks et seeds **injectés**.
- **Range #1** : jamais un point unique. Le companion MC produit `[low, high]` en BTC.
- **Mots interdits #5** : le guard `mining-note-projection.test.ts` doit rester vert.
- Ne pas toucher `mining-note-projection.ts` / `mining-note-types.ts` sauf pour le seed companion.

## Gate
`pnpm typecheck && pnpm test` vert (les 19 fichiers `engine/__tests__` + companion MC nouveau test).
Ajouter un test range low<high pour le companion MC BTC-accumulation.

## Définition de fini
Aucun `apyTarget:{8,15}` littéral ; MC BTC-accumulation seedé + testé ; surfaces yield engine
recadrées ou retirées ; pureté et range intactes ; tests verts.
