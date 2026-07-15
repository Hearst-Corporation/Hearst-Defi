# Hearst Vault v2 — PermissionedDynaVault · SOURCE DE VÉRITÉ

**Version :** v2.1 · **Date :** 2026-07-15 · **Contrat :** `PermissionedDynaVault.sol`
**Réseau :** Base Sepolia (`chainId` 84532) — aucune mainnet nulle part.

> **STATUT.** Ce document est **LA source de vérité de l'interface du vault**. Il prime sur
> toute autre représentation du vault dans le repo. L'adaptateur unique
> [`src/lib/chain/dynavault.ts`](../src/lib/chain/dynavault.ts) doit s'aligner sur CE fichier
> (et sur lui seul). Docs liés : [`DYNAVAULT_V2_WIRING.md`](DYNAVAULT_V2_WIRING.md) (état du
> câblage), [`CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md`](CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md)
> (cartographie de l'existant).
>
> **Le contrat n'est PAS déployé** : toutes les adresses sont `TBD`. L'app tourne en mode
> `legacy` sur l'ancien ERC-4626 tant que `NEXT_PUBLIC_DYNAVAULT_ADDRESS` n'est pas posée.
>
> ✅ **Asset = USDC (TRANCHÉ par Adrien, 2026-07-15).** Le vault est en **USDC** (6 décimales),
> adresse Base Sepolia `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. Le mot « USDT » de la spec
> d'origine est **caduc** : partout où elle disait USDT, lire **USDC**. Le code (2618 réf. USDC)
> est déjà aligné — aucun changement d'asset requis.
>
> ⚠️ **UN POINT NON TRANCHÉ subsiste** (détail §9) :
> 1. **Décimales des shares.** « 1:1 initially » ne dit pas *1:1 en quelle unité*. Si les shares
>    sont à 6 décimales, `SHARE_DECIMALS` (aujourd'hui 18) doit passer à 6, sinon le NAV/share
>    est faux d'un facteur 1e12, **silencieusement**.

---

## Table des matières

1. [Fonctions utilisateur](#1-fonctions-utilisateur)
2. [Fonctions admin / keeper](#2-fonctions-admin--keeper)
3. [Fonctions de lecture (views)](#3-fonctions-de-lecture-views)
4. [Événements](#4-événements)
5. [Endpoints API](#5-endpoints-api)
6. [Architecture des stratégies](#6-architecture-des-stratégies)
7. [Poche de réserve B3](#7-poche-de-réserve-b3)
8. [Guide de déploiement testnet](#8-guide-de-déploiement-testnet)
9. [Décalages connus avec le code (2026-07-15)](#9-décalages-connus-avec-le-code-2026-07-15)

---

## 1. Fonctions utilisateur

### `deposit(uint256 assets, address receiver) → uint256 shares`

**Accès :** utilisateurs whitelistés (ou ouvert si `permissionDisabled = true`)
**Description :** dépose des assets dans le vault et reçoit des shares. Les assets sont
automatiquement alloués entre stratégies selon les allocations cibles.

| Param | Type | Description |
|------|------|-------------|
| `assets` | `uint256` | Montant à déposer (6 décimales) |
| `receiver` | `address` | Adresse qui reçoit les shares |

**Retour :** `shares` (`uint256`) — shares mintées (1:1 initialement).

**Flow :** 1. transfert de l'asset user→vault ; 2. allocation vers les stratégies non-idle
(B1 Mining, B2 BTC Pouch) ; 3. la part B3 Reserve reste idle dans le vault ; 4. mint des shares.

**Event :** `Deposit(address indexed user, uint256 assets, uint256 shares)` — ⚠️ **3 params, PAS
la signature ERC-4626** (qui en a 4) → **topic0 différent**.

---

### `redeem(uint256 shares, address receiver, address owner) → uint256 assets`

**Accès :** propriétaire des shares. **Retour :** `assets` (`uint256`).

| Param | Type | Description |
|------|------|-------------|
| `shares` | `uint256` | Shares à racheter |
| `receiver` | `address` | Adresse qui reçoit l'asset |
| `owner` | `address` | Adresse propriétaire des shares |

**Flow :** 1. burn des shares ; 2. retrait proportionnel des stratégies (idle d'abord, puis
adapters) ; 3. transfert vers `receiver`.

**Event :** `Redeem(address indexed user, uint256 shares, uint256 assets)` — remplace `Withdraw`,
**renommé ET réordonné** (shares avant assets).

---

### `redeemProportional(address receiver) → uint256 assets`

**Accès :** tout détenteur de shares. Rachète **toutes** les shares du caller en une tx.

---

## 2. Fonctions admin / keeper

### Gestion des stratégies (Owner)

#### `addStrategy(address adapter, uint256 allocation, bool isIdle)`
Ajoute une stratégie. `adapter = address(0)` si idle. `allocation` en bps (10000 = 100%).
`isIdle = true` → l'allocation est satisfaite par le solde idle du vault.

**Contrainte Mining Note Mode :** exactement 3 stratégies —
B1 (4000 bps) **non-idle**, B2 (2700 bps) **non-idle**, B3 (3300 bps) **idle**.

#### `removeStrategy(address adapter)`
Retire une stratégie. Rapatrie tous les assets des adapters non-idle vers l'idle du vault.

#### `setStrategyAllocation(uint256 index, uint256 allocation)`
**Keeper.** Ajuste dynamiquement l'allocation cible d'une stratégie (moteur BTC Strategic Reserve).

### Rebalancing (Keeper)

#### `rebalance()`
Deux passes : 1. **Withdraw** — retire l'excédent des stratégies non-idle surpondérées → idle ;
2. **Deposit** — pousse l'idle vers les stratégies non-idle sous-pondérées. Les stratégies idle
(B3) sont implicitement satisfaites par ce qui reste en idle.

#### `swapAndReport(address tokenIn, uint256 amountIn, address tokenOut, uint256 minAmountOut, address selectedRouter, bytes32[] swapData)`
**Keeper.** Swap via un router DEX externe, puis déclenche un rebalancing. Cas d'usage : swap
LBTC → asset quand B2 est surpondérée et que B3 doit être rechargée.

### Paiement électricité (Keeper)

#### `payElectricity()`
Paie la facture électrique mensuelle depuis l'idle du vault. **Prérequis :** `elecPayee` set,
`monthlyElecCost` set, cooldown 30 jours écoulé, idle ≥ `monthlyElecCost`.
**Event :** `ElectricityPaid(uint256 amount, address indexed payee, uint256 timestamp)`.

### Métriques de mining (Keeper)

#### `reportMiningMetrics(uint256 hashrateTh, uint256 btcEarnedSats)`
Rapporte hashrate et BTC gagné depuis le pool externe (ex. Antpool).
**Event :** `MiningMetricsReported(hashrateTh, btcEarnedSats, totalBtcEarnedSats, timestamp)`.

### Configuration admin (Owner)

| Fonction | Description |
|----------|-------------|
| `setElecPayee(address _payee)` | Adresse du payee électricité |
| `setMonthlyElecCost(uint256 _cost)` | Coût électrique mensuel (6 décimales) |
| `setKeeper(address _keeper)` | Adresse du bot keeper |
| `setTvlCap(uint256 newCap)` | TVL max |
| `setPermissionDisabled(bool disabled)` | Active/désactive la whitelist (accès ouvert) |
| `addToWhitelist(address account)` | Ajoute un user à la whitelist de dépôt |
| `removeFromWhitelist(address account)` | Retire un user |
| `setMiningNoteMode(bool enabled)` | Active le Mining Note mode (impose 40/27/33) |
| `setCurtailmentThresholds(uint256 pre, uint256 post)` | Seuils de curtailment BTC |
| `setHalvingMonth(uint256 month)` | Mois de halving attendu |
| `setTakeProfitTier(uint256 index, uint256 btcPrice, uint256 sellBps)` | Ajoute/màj un palier take-profit |
| `resetTakeProfitTier(uint256 index)` | Réinitialise un palier |
| `setProductDurationMonths(uint256 months)` | Durée du produit (courbe de vending) |

### Moteur Mining Note (Keeper)

| Fonction | Description |
|----------|-------------|
| `runMonthlyEngine()` | Incrémente le mois, check curtailment, paie électricité, rebalance |
| `curtail()` | Pause d'urgence des dépôts B1 (BTC sous le coût) |
| `liftCurtailment()` | Reprend les dépôts B1 |
| `executeTakeProfit(uint256 tierIndex)` | Exécute un palier take-profit (vend BTC, lock vers B3) |

---

## 3. Fonctions de lecture (views)

| Fonction | Retour | Description |
|----------|--------|-------------|
| `totalAssets()` | `uint256` | Valeur totale (stratégies + idle) |
| `totalShares()` | `uint256` | Shares en circulation |
| `convertToShares(uint256 assets)` | `uint256` | Asset → shares |
| `convertToAssets(uint256 shares)` | `uint256` | Shares → asset |
| `getStrategyCount()` | `uint256` | Nombre de stratégies |
| `strategies(uint256 index)` | `(address, uint256, bool, bool)` | adapter, allocation, **active, isIdle** |
| `elecStatus()` | `(uint256, address, uint256, uint256, bool)` | cost, payee, totalPaid, lastPaymentTime, **canPay** |
| `miningMetrics()` | `(uint256, uint256, uint256)` | hashrateTh, totalBtcEarnedSats, **lastReportTime** |
| `shares(address user)` | `uint256` | Solde de shares du user |
| `whitelist(address user)` | `bool` | User whitelisté ? |
| `asset()` | `address` | Token sous-jacent — **USDC** (`0x036CbD…`, 6 déc.) |
| `keeper()` | `address` | Adresse du keeper |
| `owner()` | `address` | Owner du contrat |
| `tvlCap()` | `uint256` | TVL max |
| `permissionDisabled()` | `bool` | Whitelist désactivée ? |
| `miningNoteMode()` | `bool` | Mining Note mode actif ? |
| `isCurtailed()` | `bool` | Mining curtailé ? |
| `currentMonth()` | `uint256` | Compteur de mois |
| `reportedHashrateTh()` | `uint256` | Dernier hashrate rapporté |
| `totalBtcEarnedSats()` | `uint256` | BTC cumulé gagné |
| `monthlyElecCost()` | `uint256` | Coût électrique mensuel |
| `elecPayee()` | `address` | Payee électricité |
| `totalElecPaid()` | `uint256` | Total électricité payé |
| `lastElecPaymentTime()` | `uint256` | Timestamp dernier paiement |
| `vendingCurveBps(uint256 month)` | `uint256` | Ratio de dépletion B3 (0–10000 bps) |
| `productDurationMonths()` | `uint256` | Durée produit (courbe de vending) |

---

## 4. Événements

| Event | Description |
|-------|-------------|
| `Deposit(address indexed user, uint256 assets, uint256 shares)` | Dépôt (3 params — pas ERC-4626) |
| `Redeem(address indexed user, uint256 shares, uint256 assets)` | Rachat (shares avant assets) |
| `StrategyAdded(address indexed strategy, uint256 allocation)` | Stratégie ajoutée |
| `StrategyRemoved(address indexed strategy)` | Stratégie retirée |
| `Rebalance(uint256[] allocations)` | Rebalancing exécuté |
| `VaultSwapped(address indexed caller, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)` | Swap exécuté |
| `ElectricityPaid(uint256 amount, address indexed payee, uint256 timestamp)` | Électricité payée |
| `ElecPayeeUpdated(address indexed oldPayee, address indexed newPayee)` | Payee changé |
| `MonthlyElecCostUpdated(uint256 oldCost, uint256 newCost)` | Coût changé |
| `MiningMetricsReported(uint256 hashrateTh, uint256 btcEarnedSats, uint256 totalBtcEarnedSats, uint256 timestamp)` | Métriques rapportées |
| `CurtailmentTriggered(uint256 month, uint256 btcPrice, uint256 threshold)` | Mining curtailé |
| `CurtailmentLifted(uint256 month, uint256 btcPrice)` | Curtailment levé |
| `TakeProfitExecuted(uint256 indexed tier, uint256 btcPrice, uint256 btcSold, uint256 usdcReceived)` | Take-profit exécuté |
| `MonthlyEngineRun(uint256 month, bool fleetActive, uint256 btcPrice, uint256 elecPaid)` | Moteur mensuel exécuté |

---

## 5. Endpoints API

### Endpoints user / public

| Endpoint | Méthode | Description |
|----------|--------|-------------|
| `/api/dashboard` | `GET` | Dashboard complet : vault, stratégies, trades, historique, mining, électricité |
| `/api/vault` | `GET` | Vault : totalAssets, totalShares, TVL cap, utilisation |
| `/api/vault/strategies` | `GET` | Liste stratégies + allocations + drift |
| `/api/strategies/[index]` | `GET` | Détail par stratégie : assets, yield, solde LBTC, historique |
| `/api/rwa-vault` | `GET` | RWA Mining Vault : solde adapter, holdings LBTC, mining, électricité |
| `/api/rebalancing/status` | `GET` | Drift courant + seuil de rebalance |
| `/api/mining/metrics` | `GET` | Mining live Antpool (stub jusqu'à credentials) |
| `/api/mining/metrics/onchain` | `GET` | Dernières métriques on-chain rapportées |
| `/api/mining/electricity` | `GET` | Électricité : cost, payee, totalPaid, cooldown, prêt à payer |
| `/api/product/factsheet` | `GET` | Paramètres factsheet v4 |
| `/api/backtest/historical` | `GET` | Résultats de backtest historique |

### Endpoints keeper / admin (requièrent `KEEPER_PRIVATE_KEY`)

| Endpoint | Méthode | Description |
|----------|--------|-------------|
| `/api/mining/metrics/report` | `POST` | Rapporte hashrate + BTC on-chain (`{hashrateTh, btcEarnedSats}`) |
| `/api/mining/electricity/pay` | `POST` | Déclenche le paiement électricité |
| `/api/rebalancing/execute` | `POST` | Swap + rebalance (`{tokenIn, tokenOut, amountIn, minAmountOut, router, swapData}`) |
| `/api/rwa-vault` | `POST` | Deposit yield / withdraw / deposit (`{action, amount}`) |
| `/api/btc-deposit/initiate` | `POST` | Initier un dépôt BTC |
| `/api/btc-deposit/complete` | `POST` | Compléter un dépôt BTC |

---

## 6. Architecture des stratégies

### Mining Note Mode (3 poches)

| Poche | Allocation | Type | Asset | Idle ? | Rôle |
|--------|-----------|------|-------|-------|---------|
| **B1 · Mining Power** | 4000 bps (40%) | Adapter | USDC | Non | RWA Mining — génère du yield BTC |
| **B2 · BTC Pouch** | 2700 bps (27%) | Adapter | LBTC | Non | Détient du BTC — exposition à la hausse |
| **B3 · Reserve** | 3300 bps (33%) | Idle | USDC | **Oui** | Électricité, DCA, liquidité de sortie |

### Mode général (flexible)

- Jusqu'à N stratégies ; n'importe laquelle peut être idle (`isIdle = true`, `adapter = address(0)`).
- Allocation totale ≤ 10000 bps.

---

## 7. Poche de réserve B3

La poche B3 (33% idle) sert trois buts : 1. payer l'électricité (~16 408 $/mois pour 400k$
déployés) ; 2. acheter du BTC sur les creux (DCA optimisé) ; 3. maintenir le collatéral interne
entre poches.

**Plage de fonctionnement :** normale 20%–33% du vault. Sous 20% → swap BTC → asset pour
recharger B3. Au-dessus de 33% → l'excédent peut être swappé → BTC ou déposé en B1.

### Courbe de vending (dépletion à l'expiration)

À l'expiration (ex. 24 mois), B3 doit tendre vers zéro pour maximiser le BTC livré au client.

```
monthly_elec_payment_ratio = 1 - (current_month / total_months)
```

| Mois | Couverture facture en asset | Note |
|-------|-------------------|-------|
| 1 | 100% | Facture entièrement en asset |
| 6 | 75% | 75% asset, 25% via swap BTC |
| 12 | 50% | Moitié / moitié |
| 18 | 25% | Majoritairement BTC |
| 24 | 0% | Facture 100% via swap BTC → asset, B3 = 0 |

**Résultat :** DCA progressif dans le BTC ; à l'expiration, BTC maximal livré au client.

### Flow de paiement électricité

```
1. Keeper check /api/mining/electricity (canPay = true ?)
2. Keeper POST /api/mining/electricity/pay
3. Le vault transfère monthlyElecCost de l'idle (B3) vers le payee
4. B3 idle tombe sous la cible 33%
5. Dashboard montre le drift : B3 sous-pondérée
6. Keeper swapAndReport() si besoin (B2 surpondérée → asset)
7. Keeper rebalance() pour restaurer 40/27/33
```

---

## 8. Guide de déploiement testnet

> Ce §8 décrit l'**implémentation de référence** fournie avec la spec (`nextjs-vault-server`,
> Hardhat). ⚠️ **Hearst Connect diverge** : ce repo utilise **Foundry** (pas Hardhat) et l'adresse
> se pose via `NEXT_PUBLIC_DYNAVAULT_ADDRESS` (**pas** `VAULT_ADDRESS`). Voir §9.

**Prérequis :** Node ≥ 18, Base Sepolia RPC, clé privée avec ETH Sepolia.

```env
PRIVATE_KEY=...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=...
```

**Déploiement (référence Hardhat) :** `phase1.ts` → `phase2.ts` → `phase3.ts` puis `verify.ts`.

**Config serveur (référence) :** `VAULT_ADDRESS`, `RPC_URL`, `CHAIN_ID=84532`, `KEEPER_PRIVATE_KEY`.

**Ressources :** explorer `https://sepolia.basescan.org`, faucet Coinbase Base Sepolia.

### Adresses (testnet) — toutes `TBD`

| Contrat | Adresse |
|----------|---------|
| Vault Proxy | `TBD` |
| USDC Adapter | `TBD` |
| LBTC Adapter | `TBD` |
| RWA Adapter | `TBD` |
| Keeper Bot | `TBD` |

### Paramètres clés

| Paramètre | Valeur |
|-----------|-------|
| B1 | 4000 bps (40%) |
| B2 | 2700 bps (27%) |
| B3 | 3300 bps (33%) |
| Électricité mensuelle | 16 408 $ |
| Cooldown électricité | 30 jours |
| Curtailment pré-halving | 35 968 $ |
| Curtailment post-halving | 72 318 $ |
| Mois de halving | 21 |
| Durée produit | 24 mois |

---

## 9. Décalages connus avec le code (2026-07-15)

> Diff entre CETTE spec et l'état réel du repo (adaptateur `src/lib/chain/dynavault.ts` +
> routes + config). L'adaptateur avait été écrit contre une **version antérieure** de la spec.
>
> **✅ ALIGNEMENT FAIT (2026-07-16, orchestrateur) :**
> §9.0 asset USDC (tranché) · §9.0 décimales shares → v2=6 mode-aware, legacy 18 inchangé (`ce8a1487`) ·
> §9.1 renames `isIdle`/`canPay` (`1d806147`) · §9.2/§9.3 10 fonctions owner/keeper + 12 events ajoutés
> à l'ABI (`1d806147`) · §9.4 3 routes gatées honnêtes 501 not_supported (`1a9d4e21`). Runtime prod
> inchangé (v2 dormant). **Restent :** §9.5 swapAndReport (cosmétique), méthodo v3.0/v1.0 (hors vault,
> déférée), et les « à vérifier » §9.6 (localisation 40/27/33 côté UI, modélisation LBTC).

### 9.0 — À TRANCHER (bloquants)

- ✅ **USDC only — TRANCHÉ (Adrien, 2026-07-15).** La spec d'origine écrivait « USDT » (§1/§3) :
  **caduc**. Le vault est en **USDC** (6 déc., `0x036CbD53842c5426634e7929541eC2318f3dCF7e`). Le code
  (2618 réf. USDC, adresse en dur) est **déjà aligné** — aucun changement. `asset()` reste lu on-chain
  pour qu'un désaccord soit observable. Le mot « USDT » ne doit apparaître nulle part dans le code.
- **Décimales des shares.** « 1:1 initially » ne fixe pas l'unité. `SHARE_DECIMALS = 18`
  aujourd'hui (valeur legacy vérifiée). Si la v2 ship des shares à 6 décimales, `navPerShare` est
  faux d'un facteur 1e12, **silencieusement**. Non résolu par cette spec — à confirmer sur bytecode.

### 9.1 — Sémantiques résolues par la spec (l'adaptateur devinait, la spec confirme un AUTRE sens)

- **`strategies(index)` 4ᵉ composant :** l'adaptateur l'interprète `liquid` (deviné). La spec dit
  **`isIdle`**. Sens différent (B3 idle ≠ « liquide »). → renommer `StrategyInfo.liquid` en `isIdle`.
- **`elecStatus()` 5ᵉ composant :** l'adaptateur dit `isPaidThisMonth` (deviné). La spec dit
  **`canPay`** (cooldown écoulé + solde suffisant). Sens différent. → renommer `ElecStatus.isPaidThisMonth` en `canPay`.
- **Confirmés (aucun changement) :** `miningMetrics()` 3ᵉ = `lastReportTime` (timestamp) ✓ ;
  `miningNoteMode()` = `bool` ✓ ; `strategies` 3ᵉ = `active` ≈ `enabled` ✓.

### 9.2 — Fonctions owner/keeper ABSENTES de l'ABI de l'adaptateur (spec les déclare)

`addStrategy`, `removeStrategy`, `setElecPayee`, `setMonthlyElecCost`, `setCurtailmentThresholds`,
`setHalvingMonth`, `setTakeProfitTier`, `resetTakeProfitTier`, `setProductDurationMonths`,
`setMiningNoteMode` — **10 fonctions**, aucune dans `DYNAVAULT_ABI`. (L'adaptateur a bien
`setStrategyAllocation`, `rebalance`, `payElectricity`, `reportMiningMetrics`, `runMonthlyEngine`,
`curtail`, `liftCurtailment`, `executeTakeProfit`, `swapAndReport`, `set{Keeper,TvlCap,PermissionDisabled}`,
`add/removeFromWhitelist`.)

### 9.3 — Événements ABSENTS de l'ABI (spec en déclare 14, adaptateur 2)

Manquent : `StrategyAdded`, `StrategyRemoved`, `Rebalance`, `VaultSwapped`, `ElectricityPaid`,
`ElecPayeeUpdated`, `MonthlyElecCostUpdated`, `MiningMetricsReported`, `CurtailmentTriggered`,
`CurtailmentLifted`, `TakeProfitExecuted`, `MonthlyEngineRun`. Seuls `Deposit` / `Redeem` sont
déclarés. → nécessaires si l'app doit indexer trades/historique/proof.

### 9.4 — Endpoints de la spec NON construits

- `POST /api/rwa-vault` (`{action, amount}`) — seul le **GET** existe.
- `POST /api/btc-deposit/initiate` et `POST /api/btc-deposit/complete` — **routes inexistantes**.

### 9.5 — `swapAndReport` — cohérent mais à confirmer

Spec : `(…, address selectedRouter, bytes32[] swapData)`. Adaptateur : 5ᵉ param nommé `target`
(le nom n'affecte pas l'encodage), `bytes32[] swapData` **réaffirmé par la spec** — mais le
soupçon « c'est probablement `bytes` » subsiste et n'est levé que par le bytecode.

### 9.6 — Alignement config app (à vérifier)

- **Reframe v2 EST sur main** (commit `453dfcf0` « aligne l'UI et les documents sur le modèle
  note-de-mining v2 », HEAD actuel `e26aa2be`) — l'UI/docs sont déjà passés au modèle Mining Note.
- **Incohérence méthodologie (décalage confirmé).** `src/lib/engine/methodology.ts` a l'en-tête
  « Methodology **v3.0** » mais la constante `METHODOLOGY_VERSION = "v1.0"` (+ `@see v1.0.md`). Le
  bump v3.0 est **à moitié appliqué** — à réconcilier (une seule version affichée par les projections).
- **Allocations 40/27/33.** Absentes de `src/lib/product-strategies/strategies.config.ts` (qui
  porte d'autres produits yield/defensive/btc-plus) et de `dynavault-factsheet.ts` — vérifier où
  le 40/27/33 du Mining Note est réellement porté côté UI (ops-readout lit la chaîne en v2).
- **B2 = LBTC.** LBTC n'est référencé que dans `src/app/api/rwa-vault/route.ts` — modélisation
  fine (solde/holdings LBTC) quasi absente côté app.
- **Take-profit / curtailment / halving / durée.** L'adaptateur exécute (`executeTakeProfit`,
  `curtail`, `runMonthlyEngine`, `vendingCurveBps`, `productDurationMonths`) mais **ne peut ni lire
  ni écrire** les paramètres (`setCurtailmentThresholds`, `setHalvingMonth`, `setTakeProfitTier`,
  et leurs getters). Valeurs de référence : curtailment 35 968 $ / 72 318 $, halving mois 21,
  durée 24 mois.

### 9.7 — Contexte de déploiement

La spec §8 décrit **Hardhat + `nextjs-vault-server` + `VAULT_ADDRESS`**. Ce repo = **Foundry** +
`NEXT_PUBLIC_DYNAVAULT_ADDRESS`. Ne jamais câbler `VAULT_ADDRESS` ici (le §8 est l'impl de référence
de la spec, pas ce repo).

---

*Source de vérité de l'interface du vault. Toute évolution du contrat ⇒ mettre à jour CE fichier
en premier, puis aligner `src/lib/chain/dynavault.ts`.*
