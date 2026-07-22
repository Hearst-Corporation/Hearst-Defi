# M5 — Retrait / isolation borrow / LTV / liquidation des surfaces Series 1

**Owner** : `ui-dev` + backend (modèles) · **Vague** : 2 · **Dépend de** : décision #2 (ACTÉE = B) ·
**Périmètre** : `src/app/(product)/portfolio/preview/*`, `src/components/portfolio/position-capital-protection.tsx`,
`src/app/(product)/portfolio/_cockpit/pilot-fixtures.ts`, isolation `src/lib/products/*`

## Objectif
Garantir l'invariant Series 1 : **aucun borrow / LTV / liquidation / collateral / leverage** sur
les surfaces investisseur Series 1. La couche on-chain est déjà propre (M3) — ce travail est
**off-chain / UI**.

## Décision #2 — ACTÉE : Option B (deux produits distincts)
Series 1 = **strictement** no borrow, no LTV, no liquidation, no distribution cash, no fixed APY.
Les modèles borrow/LTV/Morpho/collateral restent **uniquement** dans un produit distinct / sandbox
admin / research :
- **jamais** dans les surfaces investisseur Series 1 (`/btc`, `/dashboard`, term-sheet, deposit,
  position) ;
- **jamais** dans la **Zandbank demo** (coordonner M8 — la fixture ne doit porter aucun collateral) ;
- **jamais** dans le **Proof Center Series 1** (coordonner M7).

Méthode = **isolation**, pas suppression : le produit à levier "BTC Mining Performance Vault" survit
séparé (`/admin/strategies`, `/admin/products/btc-mining-performance-vault`) et n'est **jamais**
importé par une surface Series 1. On ne casse pas ce produit ; on **coupe ses imports** vers Series 1.

## Tâches (fichier:ligne)
1. **Sandbox `/portfolio/preview/*`** — foyer massif de collateral/liquidation/Morpho/LLTV rendu
   comme page réelle : `_data/mock.ts:11-12,65-75,124-157,190-197,245-263` (LLTV 86%, distance-to-
   liquidation, borrow rule, Morpho wall), `preview/page.tsx:198,201`, `_charts/meter.tsx:7,26`
   (safety margin 55/45/40/20), `_charts/honest-fan.tsx`. **Défaut : dé-router / retirer** des
   parcours Series 1 (c'est un sandbox caduc v2, cf. `smart-contract-v2-status.md:47`). Si conservé
   comme labo interne, le firewaller hors navigation investisseur.
2. **`components/portfolio/position-capital-protection.tsx:50-52`** — safeguard "Collateralised
   pockets" (wBTC/USDC collateral) **rendu actif** sur la page position détail. Reformuler
   (Series 1 = pas de collateral/dette) ou retirer.
3. **`portfolio/page.tsx:110,300`** — mentions négatives ("no Morpho safety-margin", "no Morpho
   collateral/debt/liquidation") : honnêtes mais à nettoyer (le vocabulaire n'a plus lieu d'être
   si le produit n'a jamais eu de levier).
4. **`portfolio/_cockpit/pilot-fixtures.ts:18,128`** — collateral, safety margin dans les fixtures.
5. **Isolation modèles (décision #2b)** : vérifier qu'aucune surface Series 1 (`/btc`, `/dashboard`,
   term-sheet M4, deposit M4, position M4) n'importe `products/btc-mining-performance-vault.ts`
   (`liquidation:0.825`, `borrowAprPct:0.06`), `mining-canvas-model.ts`, `stable-funding-engine.ts`,
   `exit-recovery.ts`, `strategy-data-lab/collateral-rebalancing.ts`. Tracer le graphe d'import.
   Ces modèles restent pour `/admin/strategies` + `/admin/products/btc-mining-performance-vault`
   (produit distinct) — **ne pas** les casser, juste les **isoler** des surfaces Series 1.

## Invariants
- **Ne pas confondre** `product-strategies` 4-sleeves (`/admin/strategies`, produit distinct
  vivant) avec le vault Series 1.
- **Frontière M4/M5** : M4 possède term-sheet/deposit/position hero ; M5 possède
  `position-capital-protection.tsx` + sandbox `preview` + isolation modèles. Aucun fichier commun.
- Honnêteté produit préservée.

## Gate
`pnpm typecheck && pnpm test`. `grep -rn "borrow|ltv|liquidat|collateral|leverage|morpho"` sur les
surfaces Series 1 (`/btc`, `/dashboard`, term-sheet, deposit, position) = **0** après M5.
Vérif browser : screenshots Adrien (position détail, portfolio, et confirmation que `preview` n'est
plus atteignable depuis la nav investisseur).

## Définition de fini
Zéro borrow/LTV/liquidation/collateral sur les surfaces Series 1 ; sandbox `preview` dé-routé ou
retiré ; "Collateralised pockets" reformulé/retiré ; produit à levier isolé mais non cassé ;
grep de contrôle vide ; tests verts.
