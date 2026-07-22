# 00 — Décisions produit (ACTÉES 2026-07-18)

> **STATUT : TRANCHÉES par Adrien le 2026-07-18.** Ce document est désormais un **registre gelé**,
> plus une liste de questions ouvertes. Les 3 décisions actées ci-dessous pilotent l'exécution.

## Décisions actées (résumé)

| # | Décision | Verdict |
|---|---|---|
| **#1** | Rebrand | **OUI** → "Hearst Bitcoin Reserve Vault — Series 1". ADR-020 acté. M9 en **Vague 3** après convergence des fondations. |
| **#2** | Périmètre borrow/LTV | **Option B — deux produits distincts.** Series 1 = strictement no borrow / no LTV / no liquidation / no distribution cash périodique / no fixed APY. Les modèles borrow/LTV/Morpho/collateral restent **uniquement** dans un produit distinct / sandbox admin / research — **jamais** dans les surfaces investisseur Series 1, **jamais** dans Zandbank demo, **jamais** dans Proof Center Series 1. |
| **#3** | Architecture front/back | **Front Hearst-Defi = consommateur. Backend séparé = source of truth.** Aucun calcul critique Series 1 ne reste propriétaire du frontend. Voir `04-architecture-front-back.md`. |

---

## Contexte historique (les décisions telles que posées avant arbitrage)

Ces décisions ne sont **pas** tranchables depuis le code ni depuis ADR-019 : elles relèvent du
produit. Le pack les isole ici pour qu'elles soient actées avant de lancer l'exécution. Chaque
mission qui en dépend le référence.

---

## Décision #1 — Rebrand "Bitcoin Reserve Vault — Series 1"

**Constat vérifié** : le nom **n'existe nulle part** dans le repo.
`grep -i "reserve vault | series 1 | bitcoin reserve"` sur README + `docs/**` + specs +
methodology = **0 occurrence**. Les faux positifs `-l` venaient de "Reserve USDC" (pocket B3) et
`USDCReserveAdapter`. Le nom courant partout reste **"Hearst Yield Vault"** (legacy) ou
**"mining note" / "Hearst Connect"**.

**ADR-019 §99-101** : le rebrand est **explicitement hors scope** — *"the legacy brand 'Hearst
Yield Vault' carries a 'Yield' name that no longer matches an accumulation note. A brand rename
is out of scope here and is left to a product decision; this ADR does not mandate one."*

**Ce qui dépend de la décision** :
- **Oui, on rebrand** → **mission M9** propage le nom depuis les wordmarks legacy :
  `src/lib/pdf/memo-pages/cover.tsx:34`, `disclaimer.tsx:12`, `src/lib/demo/zand-fixture.ts:40,53`
  (`hearst-yield-vault`), `docs/spec/99-glossary.mdx:11`, term-sheet, vaults index, invest flow,
  `src/lib/data/vaults.ts` (ticker "HYV"), `src/lib/engine/vaults.ts:96-97`. **Nécessite un ADR-020**
  (rebrand) puisque ADR-019 ne le mandate pas.
- **Non / plus tard** → M9 est **retirée** du plan, tout le reste du pack tient (le pivot de
  modèle ne dépend pas du nom). Recommandation par défaut si non tranché : **différer M9**, faire
  d'abord converger le modèle (M1-M8), rebrand ensuite.

**Défaut proposé** : différer M9. Le modèle prime sur le nom.

---

## Décision #2 — Périmètre borrow / LTV / liquidation pour Series 1

**Constat vérifié** :
- **Couche on-chain 100 % propre** : `grep "borrow|ltv|liquidat|collateral|leverage|loan"` sur
  `contracts/**` = **0**, sur `src/lib/chain/**` = **0**. Le contrat cible
  `PermissionedDynaVault.sol` est un vault d'accumulation multi-poche, **sans dette**.
- **Le levier vit OFF-CHAIN**, dans la modélisation produit : ~1082 occurrences dans `src/lib/`,
  concentrées dans `src/lib/products/btc-mining-performance-vault.ts` (`liquidation: 0.825`,
  `borrowAprPct: 0.06`), `mining-canvas-model.ts`, `stable-funding-engine.ts`, `exit-recovery.ts`,
  `strategy-data-lab/collateral-rebalancing.ts`, `scenario-runner/*`, et le sandbox investisseur
  `src/app/(product)/portfolio/preview/_data/mock.ts` (Morpho, LLTV 86 %, distance-to-liquidation).

**La question** : "BTC Mining Performance Vault" (avec levier off-chain) et "Bitcoin Reserve
Vault Series 1" (sans levier) sont-ils :
- **(a)** le **même** produit qu'on dé-levier → il faut **retirer** les champs borrow/LTV des
  modèles et surfaces ; ou
- **(b)** **deux produits distincts** → Series 1 obtient un **modèle dédié sans borrow/LTV**, et
  l'ancien vault à levier **survit** comme produit séparé (`/admin/strategies`,
  `/admin/products/btc-mining-performance-vault`) mais n'est **jamais** exposé aux surfaces
  investisseur Series 1.

**Ce qui dépend de la décision** :
- **(a)** → M5 **supprime** borrow/LTV des modèles `src/lib/products/*` + surfaces.
- **(b)** → M5 **isole/firewall** : les surfaces Series 1 (`/btc`, `/dashboard`, term-sheet,
  deposit, position) ne consomment que des modèles sans borrow/LTV ; le sandbox `preview` et
  `position-capital-protection.tsx:50` ("Collateralised pockets") sont dé-routés/retirés des
  parcours Series 1. Les modèles à levier restent en place pour l'autre produit.

**Défaut proposé** : **(b)** — deux produits distincts. Moins destructeur, préserve le travail
existant sur le produit à levier, et respecte l'invariant "Series 1 sans levier" par isolation.
`collateral-rebalancing.ts:2` prévient déjà que son modèle 3-bucket USDC-funded ≠ vault note :
la frontière produit existe déjà en germe.

---

## Questions ouvertes secondaires (non bloquantes — défaut raisonnable applicable)

| # | Question | Défaut proposé |
|---|---|---|
| Q1 | `VAULT_DEFENSIVE` + `VAULT_BTC_PLUS` (`engine/vaults.ts:124-171`, roadmap `:907,914`) — encore full yield-APY. Repivoter ou retirer ? | **Retirer** de Series 1 ; Series 1 = un seul vault. Les garder en config morte si l'autre produit les réclame. |
| Q2 | `projection.ts` (`projectVaultApy`, APY/frais) — garder pour draft admin ou migrer BTC-accum ? | **Garder** pour l'outillage admin (draft), **ne pas** brancher aux surfaces Series 1. |
| Q3 | Investor-memo cron **mensuel** (`investor-memo-monthly.ts`) — le memo survit, mais la cadence "mensuelle" évoque la distribution. | **Garder** le memo, **renommer** la cadence (reporting périodique ≠ distribution). |
| Q4 | `Position.distributedUsdc` / `InvestorTransaction.type="distribution"` — colonnes mortes. Drop dur ou neutralisation ? | **Neutraliser** d'abord (stop d'écriture), drop DB dans une vague migration ultérieure. |
| Q5 | Adapters `USDCMiningAdapter` / `LBTCPouchAdapter` = stubs USDC. Series 1 câble du vrai LBTC/cbBTC + oracle, ou reste stub testnet ? | **Stub testnet** pour Series 1 v1 ; vrai LBTC = chantier mainnet gaté Spearbit. |
