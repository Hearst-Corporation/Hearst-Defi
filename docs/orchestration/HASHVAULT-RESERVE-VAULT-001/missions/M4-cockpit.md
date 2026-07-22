# M4 — Cockpit : term-sheet / deposit / position → KPI BTC delivered + acquisition cost

**Owner** : `ui-dev` · **Vague** : 2 · **Dépend de** : M1 (range BTC), M2 (KPI acquisition cost data) ·
**Périmètre** : `src/app/(product)/{vaults,portfolio,my-vaults}/*`, `src/components/vaults/*`,
`src/components/portfolio/*` (hors `position-capital-protection.tsx` → M5), `src/lib/data/vaults.ts`,
`src/lib/format/apy.ts`, `src/lib/constants/vault.ts`, `src/components/catalyst/apy-range.tsx`

## Objectif
Purger le vocabulaire yield/APY des surfaces investisseur legacy (`/vaults`, `/portfolio`,
`/my-vaults`) et poser les **KPI cibles Series 1 : BTC delivered + all-in BTC acquisition cost**.

## Contexte
Voir `02-cartography.md §C`. `/btc` + `/dashboard` sont déjà cible — **ne pas y toucher**. Le
chantier est le modèle legacy. Composants Catalyst uniquement (RÈGLE DESIGN #0 locale). Honnêteté
des états : préserver les zero/error-states, ne jamais fabriquer un faux Live.

## Tâches (fichier:ligne)
1. **Term-sheet** (`src/components/vaults/term-sheet-preview.tsx:8,51-65,171`) : remplacer la tuile
   "Est. yield range" (`apyLow/apyHigh`) par **BTC delivered (target, range) + all-in BTC
   acquisition cost** ; retirer `APY_DISCLAIMER_SUFFIX`. Garder `ProvenanceBadge kind="estimated"`,
   min ticket, lock-up, allocation.
2. **Deposit** (`src/components/vaults/invest-form.tsx:15,153-163,861-868`) : supprimer
   `ApyRange`/"Est. yield range" ; garder 40/27/33 (`:136`), min ticket $250k, lock-up 60j,
   KYC/accréditation gate ; réviser le langage take-profit/curtailment (`:135-139`).
3. **Position détail** (`src/app/(product)/portfolio/[positionId]/page.tsx:38,110,204-212,302-322`) :
   retirer `formatApyRange`, "Est. yield", `accruedYieldUsdc`, `ValueTrajectory` APY-driven ;
   recomposer les 4 KPI hero autour de BTC accumulé / cost basis / delivered-at-maturity (range).
4. **Surfaces annexes** : `my-vaults/page.tsx:129` (`accruedYieldUsdc`) et
   `portfolio/tax/page.tsx:33,48,50` (`totalYieldYtdUsdc`, `actualInterestIncomeUsd`) → convertir en
   BTC accumulé / coût d'acquisition. Traitement fiscal : capital gain, pas interest income
   (ADR-019 §96).
5. **Modèle data / format** : `src/lib/data/vaults.ts:21-22,89-107` (`apyLow/apyHigh`, riskLevel
   from apy) — décider abstraction (BTC-delivered range + acquisition-cost) ou dépréciation
   contrôlée ; `src/lib/format/apy.ts`, `src/lib/constants/vault.ts` (`APY_DISCLAIMER_SUFFIX`),
   `src/components/catalyst/apy-range.tsx`. `prisma/schema.prisma:38-39,509` (`currentApyLow/High`,
   `targetApyLowBps`) = **M2** (ne pas éditer le schema depuis M4 — signaler à M2).
6. **Nommage** : "Hearst Yield Vault" à `vaults/[id]/page.tsx:16`, `vaults/page.tsx:9`,
   `invest/page.tsx:17`, `confirmed/page.tsx:33` → laisser si rebrand différé (M9), sinon coordonner
   avec M9.

## Invariants
- Composants **Catalyst** uniquement. Pas de natif.
- **Honnêteté produit** : portfolio sans position → zero-state honnête, jamais faux Live/chart
  fictif. Préserver `DataNotConfigured`, badges `Simulated`, donut qui refuse de fabriquer 40/27/33.
- **Range #1** partout ; mots interdits #5 zéro.
- Ne pas toucher `/btc`, `/dashboard`, `features/investor-ui/*` (déjà cible).
- `position-capital-protection.tsx` appartient à **M5** — ne pas l'éditer ici.

## Gate
`pnpm typecheck && pnpm test` (dont `__tests__` portfolio + `prompt-227-bitcoin-accumulation.test.tsx`).
Vérif browser : screenshots demandés à Adrien (jamais de pilotage navigateur autonome — mémoire) —
term-sheet, deposit, position, full screen 1728×1117.

## Définition de fini
Zéro "Est. yield range"/`apyLow/apyHigh` sur les surfaces investisseur Series 1 ; KPI BTC
delivered + acquisition cost posés ; états honnêtes préservés ; `/btc`+`/dashboard` intacts ;
tests verts + screenshots validés par Adrien.
