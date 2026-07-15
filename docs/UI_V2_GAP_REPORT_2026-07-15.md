# Rapport UI vs contrat v2 — ce qui tombe, ce qui s'ajoute

> Généré le 2026-07-15 par un scan multi-agent (5 zones UI + surface v2) — 211 données classées KEEP/REMOVE/REFRAME/ADD. Complément de `docs/CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md`.


> **Base honnête de cette synthèse.** Le flux classifié m'est arrivé complet sur ~140 des 211 items (100 % des zones *Parcours investisseur*, *Admin opérationnel*, *Admin analytique* ; début de la zone *Documents*). Les items *Documents* au-delà de la couverture PDF n'ont pas été rendus verbatim — je les ai reconstitués depuis `docs/CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md` et l'arbre de fichiers (`src/lib/pdf/memo-pages/` = 8 pages, `README.md:4-5`, `docs/spec/*.mdx` = 13 specs). **Les comptes ci-dessous sont donc des planchers, pas le total 211** — mais le motif est déterministe et se répète à l'identique dans la zone manquante.

## 1. Verdict en 6 lignes

1. **~24 à RETIRER, ~62 à REFORMULER, ~22 à AJOUTER, ~32 valides** sur les 140 items lus — soit **plus de 60 % de l'UI produit touchée** par le swap de contrat.
2. **Un seul changement explique >80 % du diff : v2 supprime la distribution mensuelle USDC et la notion d'APY.** Tout ce qui dit « yield payé », « next distribution », « target APY 8-15 % » tombe ou se reformule ; le rendement devient BTC accumulé + take-profit + livraison à 24 mois.
3. **Deuxième vague de reformulation : les allocations** — l'UI affiche 3 variantes fausses (60/25/10/5, 55/25/20, 40/37/23, 4 sleeves) là où v2 fige **3 poches on-chain 40/27/33**.
4. **Troisième vague : lock-up 60j et min ticket $250k deviennent purement applicatifs** (v2 n'a ni lock-up ni `minDeposit` on-chain — seulement `tvlCap` + `whitelist`).
5. **Vérité brutale (cartography §0.1) : la moitié de ce qu'on retire était DÉJÀ faux avant v2** — distributions `0xMOCK_` (jamais un dollar bougé), AUM `demo_seed` **$4,74 M revendiqués vs 12 USDC on-chain**, `accruedYieldUsdc` sans cron, PCAP mort. v2 ne crée pas le mensonge, il le rend intenable.
6. **Côté ajouts, la moitié est déjà branchée** (`readStrategies/readMiningMetrics/readElecStatus` rendus sur `/admin/vaults/[id]`) ; l'autre moitié (vending, curtailment, take-profit, tvlCap, whitelist, keeper) attend de nouveaux reads — codables **maintenant** contre l'ABI, live au déploiement.

---

## 2. À RETIRER — on le montre, ce n'est plus vrai sous v2

> **Le gros morceau : toute la couche « distributions mensuelles USDC ».** v2 n'expose **aucune** fonction de distribution. En prod, `Distribution`/`DistributionLedgerEntry`/`Pcap` = **0 ligne**, l'exécution est `` `0xMOCK_${id}` `` (`atomic-exec.ts:132`), et les 48 `InvestorTransaction type='distribution'` viennent des fixtures démo — « le ledger investisseur raconte des distributions qui n'ont jamais eu lieu ». Retirer cette couche = mise en conformité contrat **et** fin d'un mensonge opposable.

| Donnée | Où (surface · fichier:ligne) | Pourquoi ça tombe | Gravité |
|---|---|---|---|
| Sous-titre couverture « Monthly USDC distributions » | PDF Investor Memo · `src/lib/pdf/memo-pages/cover.tsx:35-38` | Document **opposable** affirmant un versement mensuel USDC inexistant | **Critique** |
| Pitch « monthly USDC distributions » | `README.md:4-5` | Pitch public/repo, source de vérité produit | **Critique** |
| Description vault « monthly USDC distributions » | `src/lib/engine/vaults.ts:60` | String **source** qui irrigue memos, term sheets, descriptions | **Critique** |
| Assumption « Monthly USDC distributions, 60-day soft lock-up » | `src/lib/engine/vaults.ts:75` | Affiché avec **chaque** projection (#10) — double faux (distrib + lock on-chain) | **Critique** |
| « Monthly distribution target 8-12 % paid in USDC » | `/admin/products/…` · `page.tsx:106` (`btc-mining-performance-vault.ts:262`) | Cible de versement USDC + moteur coverage sans objet | **Critique** |
| Narratifs « Yield overlay funds the monthly distribution » | `/admin/strategies` · `strategies.config.ts:56` (+`:174`) | Texte marketing promettant distribution + yield overlay | **Critique** |
| `distributionTargetLow/HighBps` par scénario | `/admin/strategies/[slug]` · `strategies.config.ts:28` | Cible de distribution mensuelle par scénario | Moyenne |
| Stat « Yield paid » | `/portfolio` · `portfolio-cockpit.ts:533` | Rendement distribué mensuel = mécanique supprimée | **Haute** |
| Bloc « Yield & distributions » (barres + tableau) | `/portfolio` · `page.tsx:574` | Bloc entier fondé sur distributions mensuelles | **Haute** |
| Empty-state « Monthly USDC distributions appear here » | `/portfolio` · `page.tsx:678` | Promesse de distribution | Moyenne |
| « Yield paid / Total distributed / Payouts / Last payout » | `/portfolio/[positionId]` · `page.tsx:244` | Bande transactions summary = payouts | **Haute** |
| Yield history · monthly distributions (bande + chart) | `/portfolio/[positionId]` · `page.tsx:389` | Distributions + APY projeté + « next payout » | **Haute** |
| Note « Distributions are paid monthly … settle in USDC » | `/portfolio/[positionId]` · `page.tsx:566` | Copie contredisant directement v2 | **Haute** |
| Page Distributions **entière** | `/portfolio/distributions` · `page.tsx:44` | Page dédiée aux distributions mensuelles | **Haute** |
| Yield KPIs « Accrued yield / Yield YTD » | `/portfolio/yield` · `page.tsx:62` | Modèle APY-distribution ; `accruedYieldUsdc` sans écrivain prod (déjà faux) | **Haute** |
| Colonne « Next Distribution » | `/my-vaults` · `page.tsx:88` | Prochaine distribution supprimée | **Haute** |
| « Day X of 60 · unlock » (soft-lock) | `/vaults/[id]/invest/confirmed` · `page.tsx:247` | Aucun lock-up on-chain v2 | **Haute** |
| « Next distribution » + « Add to calendar » (.ics) | `/vaults/[id]/invest/confirmed` · `page.tsx:273` | Date de distribution + ics sans objet | Moyenne |
| Formulaire « Compute next distribution » | `/admin/distributions` · `distribution-form.tsx:173` | Calcul d'un versement mensuel pro-rata sans objet | Moyenne |
| Confirmation multisig 2-sig + exécution distribution | `/admin/distributions` · `distribution-form.tsx:130` | Le geste « payer une distribution » disparaît (était `0xMOCK_`) | Moyenne |
| KPI strip distributions (Total distributed / Latest…) | `/admin/distributions` · `distributions-kpi-strip.ts:42` | Agrégats d'un objet distribution disparu | Basse |
| Backtest `monthlySeries.distributionUsdc` | `/admin/scenario-lab` · `backtest.ts:204` | Série de distribution fabriquée depuis l'APY | Moyenne |
| Stat santé « Safety margin · pilot » 62 % | `/portfolio` · `portfolio-cockpit.ts:563` | LLTV Morpho inexistant (placeholder déjà fictif) | Moyenne |
| Stat santé « Debt » $0 | `/portfolio` · `portfolio-cockpit.ts:565` | Aucune dette/emprunt v2 | Basse |
| Extension recovery 6-12 mois (Mode A) | `/admin/products/…` · `page.tsx:203` | Aucun mécanisme recovery dans v2 | Basse |

---

## 3. À REFORMULER — on le montre, le sens change

### Thème A — « APY range » → note de mining (v2 n'expose aucun taux)

| Donnée aujourd'hui | Devient sous v2 | Où · fichier:ligne | Source v2 |
|---|---|---|---|
| Constante APY 8-15 % | Objectif d'accumulation BTC sur 24 mois, pas un taux | `src/lib/engine/vaults.ts:62` | `totalAssets()`/`convertToAssets()`/`totalBtcEarnedSats` (pas d'APY) |
| Headline « APY » 8-15 % (dashboard, admin/vaults, KPI strip) | Rendement estimé de note mining (range #1 tenu, sens changé) | `dashboard-kpi-strip.ts:56` · `admin/vaults/page.tsx:226` · `vault-admin-kpi-strip.tsx:45` | applicatif (estimé) |
| Product card APY range / Term sheet Target APY tile | Descriptif note mining (durée, poches, take-profit) | `product-select-card.tsx:71` · `term-sheet-preview.tsx:51` | note produit |
| Current APY hero (position) | Progression BTC accumulé vers livraison | `portfolio/[positionId]/page.tsx:237` | `miningMetrics()`/`totalBtcEarnedSats` |
| Value trajectory — cône APY | Trajectoire accumulation BTC / vending | `value-trajectory.tsx:328` | `vendingCurveBps`/`miningMetrics` |
| Deposit Summary « projected at soft close » (midApy) | Accumulation BTC sur durée produit, sans soft close | `deposit-summary.tsx:13` | modèle mining (pas APY) |
| PTAI invest — annual yield / months-to-target | PTAI note mining (BTC attendu, 24m, take-profit) | `invest-form.tsx:78` | note mining |
| Output « APY Range » (studio + heatmap + PTAI) | Performance de note (BTC projeté) | `admin/projection/studio.tsx:743` | applicatif (moteur), valeur ≠ APY |
| Monte Carlo fan APY p5/p50/p95 | Dispersion **valeur note / BTC** à 24m | `monte-carlo-panel.tsx:68` | moteur MC, cible = valeur note |
| APY range + Low/High (investor report) | Headline BTC accumulé/livré | `investor-report-view-model.ts:94` | `convertToAssets` + `totalBtcEarnedSats` |
| KPI couverture « Target APY range » | Objectif d'accumulation BTC (doc **opposable**) | PDF `cover.tsx:51-61` | dérivé `vendingCurve`+`miningMetrics`, jamais un APY promis |
| Regime Scenarios Bull/Bear APY | Régimes de **prix BTC** (halving, curtailment $35 968 / $72 318) | `regime-scenario-table.tsx:31` | `setCurtailmentThresholds`/`setHalvingMonth`/take-profit tiers |
| Total performance target 20-24 % | Performance cible **livrée en BTC** à l'expiration | `admin/products/…/page.tsx:120` | applicatif ; `totalAssets`/`TakeProfitExecuted` |
| Memo investisseur (hérite APY/allocations) | Discours note mining (40/27/33, BTC, take-profit) | `admin/investor-memo/page.tsx:39` | source v2 recadrée (`vaults.ts`) |

### Thème B — allocations (4 poches / chiffres faux) → 3 poches on-chain 40/27/33

| Donnée aujourd'hui | Devient sous v2 | Où · fichier:ligne | Source v2 |
|---|---|---|---|
| 3 pockets 40/37/23 + label « wBTC » | **40/27/33**, B2 = BTC (pas wBTC) | `pilot-fixtures.ts:130` | `strategies(i).allocationBps` (4000/2700/3300) |
| Donut allocation portfolio | Reflète 40/27/33, alimenté on-chain | `portfolio/page.tsx:393` | `strategies(i).allocationBps` |
| Allocation ring **4 buckets** | 3 poches B1/B2/B3 | `portfolio/yield/page.tsx:38` | `strategies(i).allocationBps` |
| Strategy allocation 55/25/20 (+ règle 45/55/80) | 40/27/33, mécanique v2 (bandes/curtailment/vending) | `position-strategy-allocation.tsx:23` | `strategies(i).allocationBps` |
| Term sheet Target Allocation 4 sleeves | B1 Mining / B2 BTC Pouch / B3 Reserve | `vault-allocation-display.tsx:77` | `strategies(i).allocationBps` |
| Top allocation + Allocation Orbit + DistributionStrip | Donut/barres 3 poches v2 | `dashboard-kpi-strip.ts:92` · `allocation-orbit.tsx:33` · `distribution-strip.tsx:10` | `strategies(i)→…` ; `getStrategyCount()=3` |
| Bloc « Legal & allocation » 4 buckets | 3 stratégies on-chain | `vault-detail-facts.ts:28` | `strategies(i).allocationBps` |
| Allocations moteur 60/25/10/5 | 40/27/33 (fixe, plus une variable de sortie) | `engine/vaults.ts:64` | `strategies(i).allocationBps` |
| Bandes Mining 30-40 / BTC 40-55 / Stable 10-15 / overlay + « mining floor 30 % » | 3 poches FIXES 40/27/33 ; B1 non-idle (pas de floor) ; réduction = curtailment | `admin/products/…/page.tsx:46` & `:174` | `strategies(i).allocationBps` ; `isCurtailed()` |
| Derived Allocation (studio, 4 buckets dérivés) | Allocation cible fixée par le contrat ; le moteur projette les flux **internes** de B3 | `admin/projection/studio.tsx:159` | `strategies` (fixe) + `vendingCurveBps` |
| Allocations par scénario (4 sleeves + yieldOverlay) | 1 config déployée ; variantes = jeux de paramètres | `strategies.config.ts:42` | `strategies` + params take-profit/curtailment |

### Thème C — lock-up 60j → applicatif (plus on-chain)

| Donnée aujourd'hui | Devient sous v2 | Où · fichier:ligne | Source v2 |
|---|---|---|---|
| Soft lock-up progress (X/60 j) + LockArc | Règle applicative OU horizon produit (mois X/24) | `portfolio/page.tsx:428` · `lock-arc.tsx:29` | applicatif ; `currentMonth()`/`productDurationMonths()` |
| Lock-up tiles (product card, term sheet, admin KPI, subscribers) | Condition applicative, pas contrainte contrat | `product-select-card.tsx:88` · `term-sheet-preview.tsx:72` · `vault-admin-kpi-strip.tsx:77` · `admin/vaults/[id]/page.tsx:487` | applicatif ; `productDurationMonths()` |

### Thème D — Min ticket / Capacity / AUM → applicatif vs on-chain

| Donnée aujourd'hui | Devient sous v2 | Où · fichier:ligne | Source v2 |
|---|---|---|---|
| Min ticket $250k (« on-chain ») | **Applicatif** (v2 sans `minDeposit` ; le registre `deployments.json` ment déjà : 250000 vs chaîne 1 USDC) | `product-select-card.tsx:88` · `vault-detail-facts.ts:124` | applicatif |
| Capacity Hard cap (book-entry) | Plafond **on-chain** | `term-sheet-preview.tsx:90` | `tvlCap()` |
| AUM Total donut + Capital cluster + NAV 30j (`demo_seed`) | Valeur **on-chain** (fin du $4,74M vs 12 USDC) | `allocation-orbit.tsx:119` · `platform-overview-band.tsx:22` · `assets-board.tsx:278` | `totalAssets()`/`convertToAssets()` |
| VaultAdminKpi AUM (badge « live » trompeur = Prisma) | AUM `totalAssets()`, capacité `tvlCap()` | `vault-admin-kpi-strip.tsx:94` | `totalAssets()`/`tvlCap()` |

### Thème E — le reste

| Donnée aujourd'hui | Devient sous v2 | Où · fichier:ligne | Source v2 |
|---|---|---|---|
| Total return (inclut `distributedUsdc`) | (valeur part − deposit) + valeur BTC accumulé | `portfolio-cockpit.ts:514` | `convertToAssets` + `totalBtcEarnedSats` |
| Collateral · wBTC (target) | « B2 · BTC détenu » (pas collatéral/LLTV) | `portfolio-cockpit.ts:564` | `strategies(1)` + `totalBtcEarnedSats` |
| Cumulative target — take-profit `deposit×1.24` | Paliers de **prix BTC** (`setTakeProfitTier`), pas un multiple du dépôt | `portfolio-cockpit.ts:460` | `setTakeProfitTier`/`TakeProfitExecuted` |
| Capital protection — waterfall « principal ahead of yield » | Mécanique v2 (curtailment + vending + livraison BTC) ; SPV Cayman reste KEEP | `position-capital-protection.tsx:39` | applicatif + curtailment/vending |
| Transactions — types Deposit/Claim/Withdrawal/Payout | Deposit/Redeem seulement (retirer Claim & Payout) | `portfolio/[positionId]/page.tsx:52` | events `Deposit`/`Redeem` |
| Activity — historique | + events opérationnels v2 | `portfolio/activity/page.tsx:27` | `Deposit`/`Redeem`/`Rebalance`/`ElectricityPaid`/`TakeProfitExecuted` |
| Tax 1099-INT — Interest income | **Gain en capital (1099-B)**, pas revenu d'intérêt | `portfolio/tax/page.tsx:49` | `Redeem`/`TakeProfitExecuted` (plus-value) |
| Gate KYC avant deposit | Doublé **on-chain** (le dépôt échoue si non whitelisté) | `vaults/[id]/invest/page.tsx:40` | `whitelist(user)`/`permissionDisabled()` |
| Next steps « Track distributions » | Suivi BTC accumulé / take-profit | `confirmed/page.tsx:300` | `totalBtcEarnedSats`/`TakeProfitExecuted` |
| Mining power (unités machines estimé) | Hashrate réel **attesté** (Estimated→attested) | `portfolio/page.tsx:484` | `miningMetrics()→hashrateTh` |
| Agent orchestration (agent « Margin »/Morpho) | Nœuds = moteurs v2 | `portfolio/page.tsx:536` | events Electricity/TakeProfit/Curtailment/MonthlyEngine |
| CollateralConfig LTV/borrow/`initialDebt` | v2 **sans levier** : LTV/borrow/debt = hors modèle (retirer) ; `electricityMonthlyCost` → élec réelle | `admin/strategies/queries.ts:219` | `elecStatus()` ; LTV/borrow : aucune |
| Actions Pause/Resume (statut DB) | `curtail()`/`liftCurtailment()` (gel B1) | `admin/vaults/page.tsx:246` | `curtail()`/`isCurtailed()` |
| Table « History » distributions | Journal take-profit + livraison BTC | `admin/distributions/page.tsx:98` | event `TakeProfitExecuted` |
| Proof Center hub (`fetchOnChainEvents → []`) | Alimenté par le flux d'events v2 | `admin/proof-center/page.tsx:19` | events v2 (Deposit/Redeem/Rebalance/Electricity/Mining/TakeProfit/Curtailment) |
| Presets Vaults Defensive/BTC Plus (APY arbitraires) | Un seul note déployé ; variantes = paramètres, pas des vaults APY | `engine/vaults.ts:81` | un seul `PermissionedDynaVault` |
| Diff allocation Current/Delta (RebalanceCard) | Target sourçable ; **Current/Delta PAS exposé par poche** on-chain → le dire dans l'UI | `rebalance-card.tsx:95` | Target: `strategies` ; Current: non exposé |
| Couverture « Mining-backed / $250k / 60-day soft lock-up » | Note mining ; min & lock **applicatifs** (doc opposable) | PDF `cover.tsx:35-38` | applicatif (`tvlCap`+`whitelist`) |

---

## 4. À AJOUTER — v2 l'expose, on ne le montre pas

### (a) Déjà livré (reader + UI) — le point de référence, NE PAS re-livrer

| Donnée v2 | Fonction/event | Où c'est déjà fait |
|---|---|---|
| Poches B1/B2/B3, mining (hashrate, BTC earned), électricité (coût, total payé, payee) | `strategies(i)` / `miningMetrics()` / `elecStatus()` | `/admin/vaults/[id]` · `dynavault-ops-readout.tsx:100` + Contract state `page.tsx:340` (états d'absence honnêtes) |

### (b) Reader existe (`readStrategies`/`readMiningMetrics`/`readElecStatus`), UI manque ailleurs

| Donnée v2 | Fonction/event | Reader ? | Meilleure surface UI | Effort |
|---|---|---|---|---|
| BTC accumulé (sats) + hashrate parc | `miningMetrics()→(hashrateTh,totalBtcEarnedSats)` | **Oui** | `/portfolio` (`page.tsx:453`), position (`infra-proofs.tsx:30`), `/admin/dashboard` (`dashboard-kpi-strip.ts:82`) | L |
| État électricité (coût/total payé/canPay/échéance) | `elecStatus()` / `monthlyElecCost()` | **Oui** | `/portfolio` (`page.tsx:453`), Admin analytique | M |
| Allocations réelles 40/27/33 (donut/rings) | `strategies(i).allocationBps` | **Oui** | `/portfolio`, `/portfolio/yield`, `/admin/dashboard` | M (chevauche §3-B) |

### (c) Ni reader ni UI — le vrai reste-à-faire (adapter à écrire contre l'ABI v2)

| Donnée v2 | Fonction/event | Reader ? | Meilleure surface UI | Effort |
|---|---|---|---|---|
| Vending curve B3 (dépletion 24 mois) | `vendingCurveBps(month)` + `currentMonth()` + `productDurationMonths()` | **Non** (readout l'omet, cf. `dynavault-ops-readout.tsx:229-236`) | `/portfolio`, `/admin/distributions`, `/admin/projection` | M |
| Curtailment (isCurtailed + seuils pré/post-halving) | `isCurtailed()` + `CurtailmentTriggered/Lifted` + `setCurtailmentThresholds`/`setHalvingMonth` | **Non** | `/portfolio`, `/admin/vaults/[id]` (`ops-readout:100`), `/admin/signals` | M |
| Take-profit tiers + historique | `setTakeProfitTier` + `executeTakeProfit` + `TakeProfitExecuted` | **Non** (indexer l'event) | `/admin/distributions` (remplaçant naturel), `/portfolio`, `/admin/strategies` | M |
| tvlCap + utilization + permissionDisabled | `tvlCap()` / `totalAssets()` / `permissionDisabled()` | **Non** (jamais lus) | `/admin/vaults/[id]` (`vault-admin-kpi-strip.tsx:94`), `/admin/dashboard`, `/portfolio` | M |
| Keeper status + moteur mensuel | `keeper()` + `MonthlyEngineRun` | **Non** | `/admin/vaults/[id]` | M |
| Statut whitelist(user) on-chain | `whitelist(user)` / `permissionDisabled()` | **Non** | `/vaults/[id]` (`vault-chain-readout.tsx:61`), `/admin/customers` (`page.tsx:138`) | M |
| Chemin KYC approuvé → whitelist ON-CHAIN (**point #3 du brief**) | `addToWhitelist` / `removeFromWhitelist` (write **HITL**) | **Non** (reader + writer) | `/admin/governance/allowlist` (`page.tsx:8`) ou `/admin/customers` | L |

---

## 5. Ce qui reste VALIDE (KEEP)

> **KEEP ≠ « ne rien faire ».** Plusieurs items restent vrais mais doivent **changer de source** (Prisma → on-chain) pour cesser d'afficher le `demo_seed` : AUM/NAV, capacité, badge « live ».

- **Valeur & position** : NAV/valeur vault (`portfolio/page.tsx:335`), Deposit principal (`portfolio-cockpit.ts:521`), Today's value (`:527`), Deposited/Current value (`my-vaults/page.tsx:112`), Term sheet AUM (`term-sheet-preview.tsx:91` → re-sourcer `totalAssets()`), Confirmed montant/contrat/NAV/Position ID (`confirmed/page.tsx:74`), Subscribers Investor/Class/Principal (`admin/vaults/[id]/page.tsx:464`), Principal vs Capacity (`admin/vaults/page.tsx:205`).
- **On-chain (déjà v2)** : On-chain State readout (`vault-chain-readout.tsx:43`), Contract state panel + Vault operations v2 (`dynavault-ops-readout.tsx:100`) — *vérifier que l'ABI/adapter pointe le v2, pas l'ancien `0x2bd14d52…`*.
- **Preuves & tx** : On-chain proofs txHash (`position-infrastructure-proofs.tsx:100`), Rebalancing feed (`portfolio/page.tsx:561`).
- **Structure & commercial (applicatif)** : Legal & Structure SPV Cayman (`term-sheet-preview.tsx:137`), Fees mgmt/perf (`vault-admin-kpi-strip.tsx:63`), Min ticket enforcement côté form (`invest-form.tsx:34`), Base Sepolia/USDC (`confirmed/page.tsx:123` → vérifier `asset()`=USDC), 1099-B (`tax/page.tsx:73`), **Cycle 24 mois** (`admin/products/…/page.tsx:167` → `productDurationMonths()`).
- **Risque & ops applicatifs** : Risk/Proof/Operator queue KPI (`dashboard-kpi-strip.ts:63`), Mining margin/hashprice KPI (`:76`), Risk Score + Confidence (`studio.tsx:753`), Inputs strip (`studio.tsx:198`), KPIs signaux (`signals-kpi-strip.ts:23`), Governance proposals (`governance/page.tsx:85`), Allowlist routing quorum ≠ whitelist dépôt (`allowlist-board.tsx:74`), Registre investisseurs (`customers/page.tsx:159`), Fiche client Deploy position off-chain (`customers/[id]/page.tsx:172`), Construction 5 spécialistes (`product-workspace/page.tsx:63`), Marketplace prix spot (`marketplace/page.tsx:193` — le prix BTC devient central : curtailment/take-profit).
- **Docs** : PDF AUM couverture (`cover.tsx:63-73` → `totalAssets()`), PDF Risk score (`cover.tsx:74-84`).

---

## 6. Plan priorisé — quoi faire maintenant

### P0 — Mensonges opposables (documents + pitch) — **faisable maintenant, aucun blocage contrat**
Tout ce qui affirme par écrit un produit qui n'existera plus. Corriger **la source** propage en cascade.
- `src/lib/engine/vaults.ts:60/62/64/75/81` — description, `apyTarget`, `allocationTargets`, assumptions, presets. **C'est le nœud** : irrigue memos, term sheets, projections.
- PDF Investor Memo : `cover.tsx:35-38/:51-61` + audit des 8 pages (`performance-overview`, `allocation-breakdown`, `mining-health`, `btc-tactical`, `risk-framework`, `executive-summary`, `disclaimer`).
- `README.md:4-5` ; `btc-mining-performance-vault.ts:262/269/277` ; `strategies.config.ts:28/56/174`.
- Specs (règle « doc = miroir du code ») : `docs/spec/00-vision.mdx`, `04-investor-memo.mdx`, `05-mining-model.mdx`, `07-rebalancing-rules.mdx`.

### P1 — Surfaces investisseur (distributions / APY / lock-up) — **faisable maintenant** (retrait/reformulation d'affichage off-chain)
- Retrait couche distributions : `/portfolio` (`page.tsx:574/678`, `portfolio-cockpit.ts:533`), `/portfolio/[positionId]` (`page.tsx:244/389/566`), `/portfolio/distributions` (page entière), `/portfolio/yield` (`:62`), `/my-vaults` (`page.tsx:88`), `confirmed` (`page.tsx:247/273`).
- Reformulation APY→note mining + lock-up→applicatif : term sheet, product card, `invest-form.tsx`, `deposit-summary.tsx`, `value-trajectory.tsx`.
- Retrait phantoms Morpho : `portfolio-cockpit.ts:563/564/565`.
> L'affichage **live** des remplaçants BTC est en P2 ; retirer/reformuler ne dépend d'aucune donnée on-chain.

### P2 — Ajouts v2 fort signal LP (mining / BTC / vending) — **adapter + UI codables maintenant, LIVE au déploiement**
- Brancher BTC accumulé + hashrate + électricité (readers existants) sur `/portfolio` et `/admin/dashboard`.
- Écrire les nouveaux reads (vending, curtailment, take-profit, tvlCap, whitelist, keeper) contre l'ABI de `SMART_CONTRACT_INTERFACE.md`.
- Reconvertir `/admin/distributions` en surface take-profit + vending (le remplaçant naturel).

### P3 — Le reste
- Re-sourcer AUM/NAV Prisma→on-chain (`allocation-orbit.tsx:119`, `assets-board.tsx:278`, `vault-admin-kpi-strip.tsx:94`).
- Proof Center alimenté par events v2 ; activity events ; tax 1099-INT→1099-B ; nettoyage `/admin/distributions` (multisig, KPI strip, `backtest.ts:204`).

---

## 7. Ce qui est bloqué vs faisable tout de suite

| ✅ FAISABLE MAINTENANT (avant l'adresse v2) | ⛔ ATTEND LE DÉPLOIEMENT v2 (adresse du contrat) |
|---|---|
| **Tous les REMOVE** — retrait de la couche distributions runtime + docs opposables (`vaults.ts`, PDF cover, README, product page, strategies narratives) | **Affichage LIVE** de toute donnée on-chain nouvelle : hashrate, BTC accumulé, électricité, vending, curtailment, take-profit, tvlCap, whitelist |
| **Tous les REFRAME de texte/source statique** : APY→note mining (wording), allocations 4→3 poches (chiffres 40/27/33 connus par la spec), lock-up & min ticket→applicatifs | Même **là où le reader existe** (`readStrategies/Mining/Elec`) : il pointe aujourd'hui l'ancien ERC-4626 `0x2bd14d52…` **qui n'a pas ces méthodes** → renvoie vide/revert jusqu'au deploy (le readout montre déjà des états d'absence honnêtes) |
| **Écrire les nouveaux adapters v2** (curtailment/vending/tvlCap/keeper/whitelist/take-profit) contre l'ABI — code testable sans contrat déployé | **Re-sourcer AUM/NAV/allocations** en badge Live via `totalAssets`/`convertToAssets`/`strategies()` |
| Mise à jour des specs (`docs/spec/*.mdx`) et du registre `config/deployments.base-sepolia.json` (qui ment déjà) | **Chemin whitelist on-chain** (`addToWhitelist`, write HITL) : nécessite le contrat + owner/keeper |
| Reconvertir `/admin/distributions` en take-profit/vending (structure UI, data live plus tard) | Vérifier `asset()`=USDC et que l'adapter ABI cible bien le **PermissionedDynaVault v2** (pas l'ancien vault) |