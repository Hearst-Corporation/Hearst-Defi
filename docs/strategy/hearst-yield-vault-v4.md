---
title: "Hearst Yield Vault — Spécification du smart contract (V4)"
subtitle: "1 vault = 1 client · power-NFT backé RWA · Base / cbBTC / Morpho · SPEC non déployé"
author: "Hearst Connect"
date: "2026-07-06"
status: "SPEC — non déployé — SUPERSEDES v1.0"
---

# Hearst Yield Vault — Spécification du smart contract (V4)

> **Objet.** Interface du smart contract du Hearst Yield Vault, exprimée en surface de contrat
> (états, fonctions, invariants), enrichie du **flux de mining NFTisé** (poche B1) et du **stack
> d'exécution tranché** (Base / cbBTC / Morpho / conversion quotidienne / Luxor).
>
> **⚠️ STATUT — V4 SUPERSÈDE v1.0.** Ce document décrit une **nouvelle architecture produit** qui
> **remplace** le canon [hearst-yield-vault-v1.0.md](./hearst-yield-vault-v1.0.md). Ce n'est **PAS**
> une transcription de v1.0 — les deux modèles diffèrent fondamentalement :
>
> | | v1.0 (implémenté `src/lib/engine/*`) | **V4 (ce doc)** |
> |---|---|---|
> | Structure | Mutualisé, **4 sleeves** (Mining 60/BTC 25/USDC 10/Stable 5) | **1 vault = 1 client, 3 poches** (mining 35-45 / wBTC / USDC) |
> | Mining | Revenue-share sur capacité ASIC (120 $/TH) | **NFT-de-puissance backé RWA + borrow-contre-BTC pour l'élec** |
> | Rendement | APY cible 9.4-12.8 %, distributions USDC mensuelles | **Pas d'APY** — best-effort + **take-profit +24 %** + recovery |
> | Défense | 12 règles + mode + multisig 3/5 | **Marge 55/45/40/20** vs LLTV live + **keeper hard-stop** |
> | Rail | testnet Base Sepolia, revenue-share off-chain | **Base / cbBTC / Morpho / conversion quotidienne / Luxor** |
>
> Adopter V4 exige : (a) un **ADR** actant le remplacement, (b) un **bump de méthodologie**
> (v1.0 est immutable — cf. non-négociable méthodo), (c) la matérialisation des modules ci-dessous.
>
> **Statut réglementaire.** `SPEC — non déployé`. **Modèle d'accès : B2B / investisseurs qualifiés
> uniquement, KYC-gaté** (voir §0). La **qualification par juridiction reste OPEN** (Howey / MiCA /
> deposit-taking / custody), à confirmer par un avocat AVANT commercialisation. Ce document décrit la
> forme cible, il ne fige pas le contrat.
>
> **Source de vérité (ordre de priorité).** Si ce document diverge des fichiers, **les fichiers
> gagnent**. Les modules `strategy-vision/*` et `strategy-blueprint/*` cités par les brouillons
> antérieurs **n'existent PAS encore** dans le repo — à créer si V4 est adopté. Sources réelles :
> 1. [docs/strategy/hearst-yield-vault-v1.0.md](./hearst-yield-vault-v1.0.md) — le canon **superseded** (structure, math, garde-fous hérités).
> 2. [docs/strategy-collateral-rebalancing-spec.html](../strategy-collateral-rebalancing-spec.html) — la ligne 3-poches / LTV / délestage dont V4 est la suite.
> 3. `src/lib/engine/*` — mining, rebalancing, risk, btc-tactical (math réutilisable).
> 4. `src/lib/onboarding/kyc-gate.ts`, `src/app/actions/accreditation.ts`, `src/app/actions/subscribe.ts` — **le gating d'accès B2B/KYC déjà en place** (§0).
> 5. `src/lib/data/hashprice.ts` — hashprice live (Luxor / Hashrate Index).
>
> **RULE #00 — rien n'est figé, tout est LIVE.** Chaque donnée est lue de sa source live à chaque
> tick (`LIVE → CALCULATED → PROVISIONED`). Tout nombre gravé ici (prix, LLTV, hashprice) est un
> fallback illustratif. Les seuils sont dérivés du **LLTV live de Morpho** (jamais un pivot figé).
>
> **Le capital est best-effort, JAMAIS garanti.** Le mot « garanti » ne qualifie NULLE PART le capital
> ni le rendement ; il n'apparaît que pour être nié (best-effort, recovery-adossé, borné par le
> break-even des machines à 48 mois).

---

## 0. Modèle d'accès — B2B / qualified investors, KYC-gaté (déjà câblé)

> **Ce n'est PAS de l'évasion réglementaire : c'est une exemption.** V4 n'est offert qu'à des
> **investisseurs professionnels / qualifiés (B2B)**, jamais au retail, jamais en permissionless — ce
> qui fait qu'une **licence pleine n'est pas requise** (placement privé, véhicule offshore, pas de
> sollicitation publique). Le retirer changerait tout : on ne peut pas cumuler « permissionless retail
> on-chain » ET « pas de licence » pour un titre.

Le gating d'accès **existe déjà dans l'app** et V4 en **hérite** (aucun KYC à réinventer) :

| Contrôle | Fichier existant | Effet |
|---|---|---|
| **KYC Sumsub** | `src/lib/onboarding/kyc-gate.ts` (`resolveKycWalletGate`) | Bloque l'allocation tant que `Investor.kycStatus !== "approved"`. **Fail-closed en prod** (table absente = échec contrôlé, jamais de bypass). |
| **Accréditation** | `src/app/actions/accreditation.ts` + `onboarding/accreditation` | Étape **qualified / professional investor**. |
| **Pré-flight avant tx** | `src/app/actions/subscribe.ts` | KYC + accréditation vérifiés **AVANT la tx on-chain** ; ticket min **$250k (A) / $1M (B)**. |
| **Webhook** | `src/app/api/sumsub/webhook/route.ts` | Ingest de l'état Sumsub → `kycStatus`. |

**Câblage V4 :** l'**allowlist on-chain du vault = les adresses `approved` + accréditées**. Le
pré-flight bloque déjà tout dépôt non-KYC/non-accrédité avant la tx. Geo-gating des juridictions
interdites au front + au contrat.

**Caveat honnête (non tranché ici) :** le « professionnel-only » règle proprement l'angle **titre /
fonds**. Mais l'angle **MiCA custody / CASP** (Hearst custody les machines RWA + le cbBTC + opère le
keeper) peut demander un **enregistrement CASP même en B2B** — à confirmer par un avocat, juridiction
par juridiction. Non-négociable : **jamais « garanti »**.

---

## 1. Architecture — 1 vault = 1 client

- **Un vault = un client.** Actifs **ségrégués**, jamais mutualisés. Chaque client a son propre
  contrat, son collatéral, sa dette, son `sold_ledger`. La corrélation ~1 entre vaults est un risque
  de **book** (P0), pas une raison de mutualiser.
- **Le client achète de la PUISSANCE (hashrate), jamais les machines.** Le hardware physique reste la
  propriété et la charge (CAPEX/OPEX) de Hearst, hors périmètre client. Le client détient un **droit
  sur la production**, tokenisé et pledgé on-chain. Cette puissance peut être re-routée sur un autre
  client.
- **Le dépôt USDC est DÉPLOYÉ (pas gardé)** en 3 poches, allocation **market-driven** à l'ouverture.
  Seule contrainte dure : mining **35-45 %** ; le reste (wBTC / USDC) réparti dynamiquement selon le
  marché live et le profil (Safe / Medium / Aggressive). Toute répartition affichée (ex. 40/37/23) est
  illustrative, jamais un gabarit figé.

### 1.1 Rôles / adresses

| Rôle | Adresse | Pouvoir | Limite dure |
|---|---|---|---|
| **Client** | `client` | Dépose (KYC+accrédité) ; signe le mandat (fail-closed) ; retire au dénouement. | Ne pilote pas la marge ; ne claim JAMAIS de yield libre. |
| **Hearst mining** | `hearstMining` | Retire l'USDC B1 pour acheter les machines — et, **atomiquement**, mint + dépose le NFT de puissance en collatéral. Garde physique du hardware. | Retire B1 QUE contre l'entrée simultanée du NFT (§4). Ne touche ni B2, ni B3, ni le collatéral BTC. |
| **Keeper indépendant** | `keeper` | Exécute le **hard-stop inconditionnel à 40 % de marge** (vente au marché, prix ignoré). Pré-autorisé au mandat. | Immunisé contre tous les guards ; hors LLM ; ne fait RIEN d'autre que le de-risk de solvabilité. |
| **Oracle RWA (Chainlink)** | `powerOracle` | Publie la **preuve de PRODUCTION** (BTC reçu on-chain) + l'état de la puissance (hashrate actif, halving). Multi-source. | Read-only : ne déplace aucun fonds ; alimente la santé collatéral + le forward-runway. |
| **Morpho** | (externe) | Détient le **mur** de liquidation (LLTV live). | Hors gouvernance Hearst ; peut baisser son LLTV → seuils resserrés au tick suivant. |

**FAIL-CLOSED.** Pas de mandat valide (signé, non révoqué, action autorisée) → **aucune action
discrétionnaire**. Le hard-stop keeper est la seule exception (pré-autorisé à l'onboarding).

---

## 2. Les 3 poches et le collatéral

| Poche | Contenu | Rôle | Empruntable ? |
|---|---|---|---|
| **B1 — Mining (puissance tokenisée)** | Droit à la puissance (hashrate), **jamais les machines**. Bornée **35-45 %**. | USDC retiré par `hearstMining` pour acheter les machines ; NFT de puissance mint + pledgé (§4). Mine du BTC → cbBTC quotidien (÷2 au halving). | Le **BTC produit** rejoint le collatéral. Le NFT lui-même **non liquidable** on-chain (droit à la puissance, pas la revente machine) — risque P0 contrepartie. |
| **B2 — wBTC (yield / collatéral)** | wBTC acheté à l'ouverture, placé en yield (taux DeFi live). | Yield ET collatéral. | **OUI** (BTC total). |
| **B3 — USDC (productif)** | USDC en yield (Morpho/Aave, taux live). Yield **variable, non garanti**. | Actif productif qui **finance l'élec en premier** et nourrit le rebalancing. | Non (USDC). |

**COLLATÉRAL EMPRUNTABLE = TOUT LE BTC DU VAULT** = wBTC B2 acheté **+ BTC miné** (B1). Raison :
au mois 1 le BTC miné ≈ 0 ; n'emprunter que contre lui = ~30 % de la liquidation immédiatement. On ne
compte que les **actifs liquidables** (le BTC total) ; la puissance NFTisée n'y entre pas.

---

## 3. Cycle de vie — machine d'états

`active → take_profit_hit | matured | recovery → closed`

- **`active`** — nominal. **Dette = 0 est l'état sain.** Marge défendue par 55/45/40, jamais par un
  circuit-breaker ni kill-switch : les machines minent en continu.
- **`take_profit_hit`** — dès `deployedValue ≥ dépôt × 1.24` (**+24 %**, ajustable), **même à 6 mois** :
  expiration immédiate (§8).
- **`matured`** — durée max atteinte, client ≥ 0 : glide-path proactif par tranches (jamais un dump).
- **`recovery`** — durée max atteinte, client < 0 : machines continuent, mgmt fee suspendu, borné (§8).
- **`closed`** — réglé. Hearst récupère le hardware résiduel **après** le client (subordonné, §9).

---

## 4. Le flux MINING NFTisé — cœur de B1

> **NFT DE PUISSANCE BACKÉ PAR DES MACHINES RWA.** Pas un simple « NFT hybride » : un **NFT de
> puissance, backé par des machines RWA** — des **ASIC physiques réels, sérialisés** (Real-World
> Assets, garde physique Hearst). Le NFT est **adossé** à ces machines réelles, MAIS le **DROIT** qu'il
> porte comme collatéral est la **PUISSANCE (hashrate)**, **jamais un titre de revente sur le
> hardware**. Formulation canon : **« NFT de puissance, backé par des machines RWA (garde physique
> Hearst), portant un droit sur le hashrate — jamais un titre de revente sur le hardware ».**
> L'actif sous-jacent est réel (RWA), mais **power ≠ machine**.

### 4.1 Principe

1. La part mining (B1) **n'est pas déployée en DeFi** — elle est **retirée par `hearstMining`** pour
   acheter les machines.
2. **NFT backé RWA** adossé à des ASIC réels sérialisés ; **garde physique Hearst** ; pledgé en
   collatéral = **le droit à la puissance**, pas la revente machine.
3. **RETRAIT ATOMIQUE.** Quand `hearstMining` retire l'USDC B1, on **mint le NFT** (hashrate acheté) et
   on le **dépose comme collatéral** dans la **MÊME transaction**. L'USDC ne sort QUE contre le NFT qui
   entre — sinon revert.
4. **Production.** Le NFT produit du BTC quotidien → **cbBTC**, qui **rejoint le collatéral BTC total**.
   Production ÷2 au halving (date live mempool.space).

**⚠️ Ce que l'atomicité atténue (et n'efface pas).** L'échange atomique supprime le **délai de
confiance intra-tx** (l'USDC ne part jamais « en l'air »). Combiné à la garde physique + la preuve de
production on-chain, il **atténue** le P0 contrepartie — il ne l'**efface pas** : l'atomicité garantit
que le *token* entre, **pas** que les machines existent/produisent ; le NFT reste **non liquidable**
on-chain (on ne saisit pas un ASIC par une vente on-chain). Mitigations canon toujours requises : **SPV
bankruptcy-remote**, opérateur **step-in pré-contracté**, oracle multi-source, ne compter que le BTC
total (liquidable) dans le ratio.

### 4.2 Pseudo-code de l'opération atomique

```text
function fundMiningAgainstPower(usdcAmount, machineSerials[], hashrateTHs, powerAttestation):
    require(msg.sender == hearstMining)
    require(state == active)
    require(usdcAmount <= pocketB1.remainingUsdc)
    require(withinMiningBand(pocketB1.committedUsdc + usdcAmount))   // 35-45%
    require(powerOracle.verify(powerAttestation, machineSerials, hashrateTHs))
    // --- une seule transaction : les deux jambes ou rien ---
    tokenId = powerNFT.mint(to=address(this), serials=machineSerials, pledged=HASHRATE_RIGHT(hashrateTHs))
    collateral.pledgePowerNFT(tokenId)                // entre comme collatéral (non liquidable)
    pocketB1.remainingUsdc -= usdcAmount
    usdc.transfer(hearstMining, usdcAmount)           // l'USDC ne sort QUE maintenant
    emit MiningPowerFunded(tokenId, usdcAmount, hashrateTHs, machineSerials)
    // invariant : (usdcOut == usdcAmount) ⇔ (NFT pledgé) ; sinon revert.
```

### 4.3 Le flux BTC produit — conversion QUOTIDIENNE en cbBTC (Base)

> **Design ARRÊTÉ (stack §13).** La production ne transite plus « chez Hearst » de façon opaque : elle
> est **versée et convertie on-chain CHAQUE JOUR** en **cbBTC** (Coinbase Wrapped BTC — **wrapped BTC
> RÉEL, PAS un stablecoin** : exposition **Bitcoin**) sur **Base**. Le collatéral devient **visible et
> matérialisé on-chain quotidiennement**.
>
> **Pourquoi le quotidien devient viable.** L'ancien batch mensuel n'existait qu'à cause du coût d'un
> bridge. Ce motif **disparaît** : sur Base le **gas est dérisoire** ET le **wrap cbBTC 1:1 est
> gratuit** (BTC → adresse Base via Coinbase = cbBTC). Le quotidien devient **économiquement viable**.

1. **Rail :** **Luxor (payout BTC) → Coinbase (BTC → cbBTC 1:1) → Base → collatéral vault.**
2. **Conversion quotidienne** (remplace le batch mensuel). Le collatéral cbBTC est **visible on-chain
   chaque jour**.
3. **Cadence configurable, défaut quotidienne, calée sur les factures d'élec** (~2 du mois).
4. **Rembourse d'abord Hearst pour l'élec avancée.** Hearst **avance l'élec** ; sur le cbBTC produit, la
   part = facture élec revient à Hearst (**remboursement**), le **NET** rentre en collatéral client.
5. **Le yield de farming va au client.**

**Articulation §5 :** la production convertie quotidiennement **EST le rang 2** de l'ordre de
financement élec — elle **ne bouscule pas** `B3 → production → yield cbBTC → borrow conditionnel →
vente`. Le remboursement Hearst est le règlement de l'avance élec de rang 2.

**Rail FIXÉ (plus OPEN) :** Coinbase (BTC → cbBTC 1:1) → Base. Plus de choix de bridge à trancher.
`cbBTC ≠ stablecoin` : l'exposition reste **Bitcoin** (best-effort, jamais garanti).

---

## 5. La boucle électricité / borrow

### 5.1 Les yields ne sont pas un claim client

**Aucun claim de yield libre.** Les yields (B2/B3) sont **composés dans leur poche** ET **financent
l'élec / nourrissent le rebalancing**. Seul « retrait » client = au dénouement. Rendement USDC
**variable et non garanti** (positif, nul ou négatif).

### 5.2 Ordre de financement (rang par rang, partiel autorisé)

```text
1. USDC B3 (productif)                — source primaire, nominal
2. Production BTC courante, convertie — si B3 insuffisant
3. Yield wBTC B2                      — pour tenir la marge dans la bande
4. BORROW_USDC_CONDITIONAL           — SEULEMENT si marge post-borrow ≥ 45 %
5. Vente BTC (de-risk)               — dernier recours
```

- **Borrow UNIQUEMENT pour payer l'élec**, afin de **GARDER le BTC** = financement opé, **PAS du
  levier**, pas un carry.
- **Un vault sans dette est sain** (dette = 0 nominal). Le borrow n'est jamais nominal ; **conditionnel**.
- **Mining non rentable ≠ emprunter plus** (anti-spirale) : net burn positif soutenu (N jours) ET
  runway stressé < 6 mois → `REDUCE_RISK`. Jamais « emprunte plus ».
- Métriques live : `hashprice_live`, `net_burn_rate = coût élec − valeur production`, `runway_months`,
  `runway_months_stressed` (hashprice p5), `forward_runway_post_halving`.

---

## 6. Défense de marge — échelle 55/45/40/20

Seul axe de pilotage : `safety_margin_pct` = **distance à la liquidation** (**HAUT = SÛR**). Le raw LTV
est un OUTPUT. La correspondance marge↔LTV est **dérivée du `lltv_live` à chaque run**, jamais figée.

| Marge | Signification | Chemin | Approbation |
|---|---|---|---|
| **55 %** | **RECHARGE** — restauration conditionnelle (uniquement si vendu à 45 avant, borné au sold ledger). | Discrétionnaire | Selon mandat (SLA) |
| **45 %** | **DE-RISK** — défense NON-vendeuse d'abord (injecter wBTC / payer depuis B3), puis vendre (43-44 toléré si support optimisé). | Safety | **Pré-autorisée au mandat** |
| **40 %** | **HARD_STOP_KEEPER_SELL** — keeper, vente au marché, **prix ignoré, inconditionnel**. | Safety | **Aucune** (pré-autorisé) |
| **20 %** | Liquidation **Morpho** — **LE MUR** (LLTV live). | Protocole | — |

Invariant : `liquidation (20) < hardStop (40) < sell (45) < recharge (55)`.

- **PAS de « marge 0 », PAS de pivot figé « 80 », PAS de circuit-breaker, PAS de kill-switch mining.**
  Le mur EST Morpho, mesuré contre le **LLTV live**. Le hard-stop à 40 siège **20 pts au-dessus** du mur.
  ⚠️ **À re-dériver numériquement contre le LLTV 86 % de Morpho Base cbBTC/USDC** (à LLTV plus haut, les
  buffers en prix sont plus serrés) — les seuils flottent sur le LLTV live, mais vérifier l'air restant.
- **Keeper hard-stop** : autonome, event-driven (<1 s cible), immunisé contre tout guard, hors LLM. Le
  cron 1-5 min = heartbeat de secours. Ne PAUSE jamais sous stress de solvabilité.
- **Sold ledger (on-chain).** Toute vente inscrit `sold_btc` / `remaining_to_rebuy`. Rebuy impossible
  sans lui.
- **Rebuy borné** : `rebuy_btc ≤ montant exactement vendu` — **JAMAIS de fresh leverage**. Conditions
  cumulatives : marge ≥ 55, `remaining_to_rebuy > 0`, buffers/runway ok, marché non stressé, aucun
  guard bloquant, confirmation 48-72 h.

### 6.1 Rebalancing DÉTERMINISTE, oracle-driven (Chainlink)

> **Décidé.** Le rebalancing n'est **pas discrétionnaire** : seuils et arbitrages **sourcés d'oracles
> (Chainlink)** et exécutés par du **code immuable** — pas de main humaine dans la boucle. C'est un
> **gain réel de décentralisation sur la couche trésorerie** (retire le trigger « gestion de
> portefeuille discrétionnaire »).
>
> **Honnêteté :** ceci **ne retire PAS la qualification titre**. La branche Howey « profit tiré de
> l'effort d'autrui » reste satisfaite par **l'opération de mining elle-même** (Hearst exploite les
> machines). La qualif est gérée par l'**exemption professional-only** (§0), pas par l'automatisation.
> Pour que « déterministe » tienne : **contrat immuable, sans admin key, sans keeper privilégié qui
> vend arbitrairement, oracle décentralisé, paramètres figés au déploiement.**

---

## 7. Deux chemins d'exécution

- **SAFETY PATH** (déterministe, non-LLM) : de-risk 45 (pré-autorisé), hard-stop 40 keeper, réponse au
  stress de solvabilité, fallback oracle conservateur. **Ne peut être bloqué par aucun guard**, ne
  PAUSE jamais.
- **DISCRETIONARY PATH** (run de décision) : rebuy (borné sold-ledger), glide-path non urgent, updates
  de profil, allocation en régime calme, take-profit non crash. Approbation où le mandat l'exige (SLA +
  timeout fallback). Chaque CTA porte TTL, limit price, slippage, fallback, idempotency key.
  **FAIL-CLOSED**.

---

## 8. Sorties du vault

- **`takeProfitExpire` — +24 %.** Dès `deployedValue ≥ dépôt × 1.24` (**même à 6 mois**), le vault
  **CLÔTURE et EXPIRE**. Client sort à **capital +24 %** ; la société garde **le surplus au-dessus de
  +24 %** et **les machines** (divulgué à l'onboarding). Lock = durée **MAXIMUM**, pas un terme. **⚠️
  Asymétrie à rendre limpide au LP** : upside plafonné contre coussin recovery — un cap disclosed, pas
  gratuit.
- **`glidePath` — durée max, client ≥ 0.** Vente **proactive, time-based, par tranches**, jamais un
  dump terminal (budget de vente séparé du défensif).
- **`enterRecovery` — client < 0 à la maturité.** Machines **continuent** ; `(BTC produit − élec)`
  routé au client on-chain. **MANAGEMENT FEE SUSPENDU** tant que client < 0 (**100 %** du `BTC−élec` au
  client). **Borné — stop au 1er de** : client à 0 % · **+12 mois** · **48 mois** de vie machine. Lock
  24 → recovery jusqu'à 36 mo ; lock 36 → jusqu'à 48 mo. **Best-effort, borné, JAMAIS garanti.**

---

## 9. Rémunération de la société — subordonnée au client

Le client achète la POWER, jamais les machines : le hardware reste à la société, récupéré **seulement
après** règlement du client. Trois flux :

1. **Vente du hardware résiduel** — après règlement client (subordonné).
2. **Management fee 2-8 % de la PART DE HASHRATE** — **en nature** sur la puissance / le BTC produit,
   **jamais sur l'AUM** — **SUSPENDU tant que client < 0**.
3. **Performance fee** — High-water mark / Hurdle / Net (sélectionnable).

---

## 10. Interface Solidity (INTERFACE + NatSpec — pas d'implémentation)

```solidity
// SPDX-License-Identifier: UNLICENSED
// SPEC — non déployé. V4 supersedes v1.0. Accès B2B/qualified KYC-gaté (§0).
// Qualification réglementaire OPEN (Howey/MiCA/deposit/custody) par juridiction.
pragma solidity ^0.8.24;

/// @title  Hearst Yield Vault V4 — interface (1 vault = 1 client)
/// @dev    INVARIANTS GLOBAUX :
///         - Accès : dépôt réservé aux adresses KYC `approved` + accréditées (allowlist,
///           héritée de kyc-gate.ts / accreditation.ts / subscribe.ts).
///         - 1 vault = 1 client ; actifs ségrégués, jamais mutualisés.
///         - Client achète la PUISSANCE (hashrate), jamais les machines. Collatéral mining =
///           NFT de puissance BACKÉ RWA (ASIC réels, garde Hearst) portant un droit sur le
///           hashrate — pas de revente hardware.
///         - Collatéral empruntable = TOUT le BTC (wBTC B2 + BTC miné B1, converti cbBTC).
///         - Borrow USDC UNIQUEMENT pour l'élec (garder le BTC), et seulement si post-borrow ≥ 45.
///         - Yields NON claimés par le client : composés + financent l'élec.
///         - Marge 55/45/40/20 vs LLTV Morpho LIVE (Base cbBTC/USDC 86%) ; hard-stop 40 keeper
///           inconditionnel ; 20 = mur Morpho. Pas de circuit-breaker, pas de kill-switch.
///         - Rebalancing DÉTERMINISTE oracle-driven (Chainlink), contrat immuable, pas d'admin key.
///         - Rebuy ≤ montant exactement vendu (sold ledger) ; JAMAIS de fresh leverage.
///         - Capital best-effort, JAMAIS garanti.
interface IHearstYieldVaultV4 {
    enum State { Active, TakeProfitHit, Matured, Recovery, Closed }
    enum Action {
        HOLD, SELL_BTC_REPAY_USDC, HARD_STOP_KEEPER_SELL, REBUY_BTC_BOUNDED,
        PAY_ELECTRICITY_FROM_USDC_B3, PAY_ELECTRICITY_FROM_BTC_PRODUCTION,
        PAY_ELECTRICITY_FROM_WBTC_YIELD, BORROW_USDC_CONDITIONAL, USE_USDC_BUFFER,
        REDUCE_RISK, UPDATE_STRATEGY_PROFILE, TAKE_PROFIT_EXPIRE, ENTER_RECOVERY,
        SUSPEND_MGMT_FEE, GLIDE_PATH_TRANCHE, PAUSE_DATA_INSUFFICIENT
    }

    // modifier onlyClient() / onlyKeeper() / onlyHearstMining() / onlyAllowlisted() (KYC+accredited)

    event VaultOpened(address indexed client, uint256 depositUsdc);      // onlyAllowlisted
    event Allocated(uint256 miningBps, uint256 wbtcBps, uint256 usdcBps); // mining ∈ [3500,4500]
    event MiningPowerFunded(uint256 indexed powerTokenId, uint256 usdcOut, uint256 hashrateTHs, bytes32 machineSerialsRoot);
    event BtcPoolFunded(uint256 btcAmount, uint256 poolBalanceAfter, uint256 dayTs);          // payout Luxor (BTC)
    event BtcConverted(uint256 btcIn, uint256 cbBtcOut, uint256 dayTs);                        // BTC → cbBTC 1:1 (Base)
    event ElectricityReimbursed(uint256 cbBtcToHearst, uint256 electricityAdvancedUsdc);
    event CollateralInjected(uint256 cbBtcToClientCollateral, uint256 farmingYieldToClient);
    event ElectricityFunded(Action[] fundingPath, bool borrowRequired, int256 postBorrowMarginBps);
    event SafetyDeRisk(uint256 soldBtc, uint256 safetyMarginBps);          // 45
    event HardStopKeeperSell(uint256 soldBtc, uint256 safetyMarginBps);    // 40 — inconditionnel
    event RebuyBounded(uint256 rebuyBtc, uint256 remainingToRebuy);        // ≤ sold ledger
    event TakeProfitExpired(uint256 clientPayoutUsdc, uint256 companySurplusUsdc);
    event GlidePathTranche(uint256 soldBtc);
    event RecoveryEntered(uint256 maturityTs);
    event MgmtFeeSuspended(bool suspended);
    event VaultClosed(State finalState);

    /// @notice Ouvre le vault. onlyAllowlisted (KYC approved + accredited). miningBps ∈ [3500,4500] ;
    ///         somme = 10000 ; allocation market-driven.
    function open(uint256 depositUsdc, uint256 miningBps, uint256 wbtcBps, uint256 usdcBps) external;

    /// @notice RETRAIT ATOMIQUE : USDC B1 → hearstMining ⇔ mint + pledge NFT de puissance (backé RWA).
    ///         (usdcOut == usdcAmount) ⇔ (powerTokenId pledgé) sinon revert. onlyHearstMining.
    function fundMiningAgainstPower(uint256 usdcAmount, bytes32 machineSerialsRoot, uint256 hashrateTHs, bytes calldata powerAttestation) external returns (uint256 powerTokenId);

    /// @notice CONVERSION QUOTIDIENNE : BTC produit (Luxor) → cbBTC 1:1 (Coinbase/Base) ; rembourse
    ///         l'élec avancée à Hearst ; injecte le NET en collatéral client + farming yield au client.
    ///         Rang 2 de l'ordre §5. onlyKeeper (ou onlyHearstMining).
    function dailyBtcConversion() external;

    /// @notice Finance l'élec : B3 → production cbBTC → yield wBTC → borrow conditionnel (≥45) → vente.
    function fundElectricity(uint256 electricityDueUsdc) external;

    /// @notice DE-RISK 45 % (safety, pré-autorisé) ; inscrit le sold ledger.
    function deRiskSell(uint256 minSafetyMarginBps) external;
    /// @notice HARD-STOP 40 % : vente marché, prix IGNORÉ, INCONDITIONNEL. onlyKeeper.
    function hardStopKeeperSell() external;
    /// @notice REBUY borné ≤ sold ledger ; marge ≥ 55 ; JAMAIS de fresh leverage.
    function rebuyBounded(uint256 rebuyBtc) external;

    /// @notice TAKE-PROFIT +24 % → EXPIRE (même à 6 mois). Client +24 %, société surplus + machines.
    function takeProfitExpire() external;
    /// @notice GLIDE-PATH : tranches time-based, jamais un dump.
    function glidePathTranche() external;
    /// @notice RECOVERY : client < 0. Machines continuent ; (BTC−élec) au client ; mgmt fee suspendu.
    ///         Borné {0 % · +12 mois · 48 mois}. Best-effort, JAMAIS garanti.
    function enterRecovery() external;

    // Vues (tout LIVE)
    function state() external view returns (State);
    function safetyMarginBps() external view returns (uint256 safetyMarginBps, uint256 lltvLiveBps);
    function totalBtcCollateral() external view returns (uint256 totalBtc); // wBTC B2 + BTC miné
    function soldLedgerRemainingToRebuy() external view returns (uint256 remainingBtc);
    function debtUsdc() external view returns (uint256 debt);               // 0 = sain
    function mgmtFeeSuspended() external view returns (bool);
}
```

---

## 11. Invariants garantis

1. **Accès B2B/qualified KYC-gaté** : dépôt réservé aux adresses `approved` + accréditées (hérité de
   `kyc-gate.ts` / `accreditation.ts` / `subscribe.ts`, fail-closed).
2. **1 vault = 1 client**, ségrégué, jamais mutualisé.
3. **Client achète la puissance, jamais les machines** : NFT backé RWA (ASIC réels, garde Hearst) ;
   droit pledgé = hashrate ; jamais un titre de revente hardware.
4. **Retrait mining atomique** : `usdcOut(B1) == usdcAmount ⇔ NFT pledgé` (sinon revert).
5. **Mining borné 35-45 %** ; allocation market-driven, somme = 100 %.
6. **Collatéral empruntable = TOUT le BTC** (wBTC B2 + BTC miné cbBTC) ; NFT non liquidable.
7. **Borrow UNIQUEMENT pour l'élec, seulement si post-borrow ≥ 45 %** ; dette 0 = sain ; « non rentable
   ≠ emprunter plus ».
8. **Aucun claim de yield libre** ; seul retrait = au dénouement.
9. **Échelle 55/45/40/20 vs LLTV live**, `20 < 40 < 45 < 55` ; DS ne peut que **resserrer** ; mur 20
   intouchable.
10. **Rebalancing déterministe oracle-driven** ; contrat immuable, pas d'admin key, pas de keeper qui
    vend arbitrairement.
11. **Hard-stop 40 inconditionnel** (prix ignoré, immunisé, sans approbation temps réel). Pas de
    circuit-breaker ni kill-switch.
12. **Rebuy ≤ montant exactement vendu** ; JAMAIS de fresh leverage.
13. **Take-profit +24 % → expiration** ; client +24 %, société surplus + machines ; lock = MAXIMUM.
14. **Recovery : mgmt fee suspendu tant que client < 0** ; `(BTC−élec)` 100 % au client ; stop {0 % /
    +12 mo / 48 mo}.
15. **Rémunération société subordonnée** ; mgmt fee 2-8 % en nature (pas sur l'AUM) ; perf fee.
16. **Mandat FAIL-CLOSED** ; hard-stop keeper pré-autorisé.
17. **Capital best-effort, JAMAIS garanti** ; recovery-adossé, borné break-even 48 mo.
18. **Tout est LIVE** (RULE #00) ; aucun pivot figé.

---

## 12. Risques P0 & points OPEN

### 12.1 Risques P0

- **Contrepartie off-chain (le plus structurant).** Le NFT de puissance n'est **ni saisissable ni
  liquidable on-chain** — seul le BTC/cbBTC l'est. **Atténué** par NFTisation atomique + garde physique
  + preuve de production ; **non effacé**. Mitigations : **SPV bankruptcy-remote**, sûretés
  client-priority, **opérateur step-in pré-contracté**, oracle multi-source, ne compter que le BTC total.
- **Spirale électricité.** Payer l'élec en empruntant contre du BTC qui mine à perte = ratchet.
  Mitigation : net burn-rate live, runway stressé, borrow **conditionnel** (≥45), anti-spirale
  `REDUCE_RISK`, backstop keeper + recovery.
- **Qualification réglementaire.** Dépôt + lock + rendement + préservation + **borrow contre le BTC du
  client** peut qualifier en investment contract (Howey) et lending/deposit régulé (MiCA). « Acheter la
  power » aide le cadrage **mais ne retire pas** la qualif. **Géré par l'exemption professional-only /
  KYC-gaté (§0)** — pas par l'automatisation du rebalancing. **Angle MiCA CASP/custody à confirmer par
  juridiction** même en B2B. **Jamais « garanti ».**
- **Dérive de marge.** Dette d'élec qui compose + BTC miné ÷2 au halving + BTC miné ≈ 0 au lancement →
  collatéral = TOUT le BTC. Un gap brutal peut resserrer une bande étroite. Mitigation : bande 45-55,
  marge live vs LLTV, hard-stop 40, pilotage sur la marge **forward**. **Re-dériver contre LLTV 86 %.**
- **Concentration du rail.** cbBTC (**centralisé, Coinbase** — gel/depeg possible) + un seul L2 (Base)
  + un seul pool (Luxor). À arbitrer contre le bénéfice « collatéral visible ».
- **Corrélation ~1 & best-effort non provisionné.** Chaque poche suit le hashprice ; 1 vault = 1 client
  → corrélation ~1, aucun fonds externe. Mitigation : best-effort borné break-even 48 mo ; recovery ;
  OU provisionner un fonds externe non corrélé (USDC/T-bills) dimensionné au CVaR agrégé.

### 12.2 Points OPEN (bloquent le gel du contrat)

**Décidé** : capital best-effort ; client achète la power ; collatéral = tout le BTC vs LLTV live ;
échelle 55/45/40/20 sans circuit-breaker ni kill-switch ; take-profit +24 % expire ; recovery bornée ;
mining 35-45 % ; tous inputs LIVE ; **accès B2B/qualified KYC-gaté (§0)** ; **rebalancing déterministe
Chainlink** ; **stack Base / cbBTC / Morpho Base cbBTC-USDC LLTV 86 % / conversion quotidienne / Luxor
(§13)**. **Encore OPEN** :

- **Qualification réglementaire & véhicule** par juridiction (Howey / MiCA CASP / deposit / custody) —
  véhicule offshore régulé / placement qualified-investor ; confirmer par avocat.
- **Définition exacte de « zéro »** pour la recovery (working def : USDC nominal brut).
- **Waterfall du surplus / performance fee** (high-water / hurdle / net ; partage éventuel > +24 %).
- **Comptabilité puissance ↔ hardware** par vault (dédié vs pooled pro-rata) — impacte le mint NFT.
- **Câblage LLTV live** : le lecteur `protocol-rates` doit pointer le **marché Morpho Base cbBTC/USDC
  (LLTV 86 %)** — même logique de lecture, seule l'adresse change. Faire flotter les seuils reste à câbler.
- **Hedging du risque daté** (halving / hashprice / difficulté / élec) : autorisé ou interdit par mandat ?
- **Stress au niveau book** : N vaults en recovery simultanément, corrélation ~1 (pas de mutualisation).
- **Cœur tactique réservé** : jeu de défense, arbitrage élec/collatéral/vente, comportement post-halving.
- **Matérialisation V4** : créer les modules (`strategy-vision/*`, `strategy-blueprint/*` ou équivalent),
  ADR de supersession de v1.0, bump méthodologie.

Tant que ces points sont OPEN, **le contrat n'est pas figeable** : ce document reste une **SPEC**.

---

## 13. Stack technique retenu (DÉCIDÉ)

> Le **canon de stratégie ne change PAS** (55/45/40/20, take-profit +24 %, recovery bornée, mining
> 35-45 %, tous inputs LIVE). **Seul le stack d'exécution est précisé.**

| Axe | Choix | Détail |
|---|---|---|
| **Chaîne** | **Base** (L2 Ethereum) | Gas **négligeable** ; sécurité via rollup Ethereum (settlement L1). |
| **Collatéral** | **cbBTC** (Coinbase Wrapped BTC) | **Wrapped BTC RÉEL** — exposition Bitcoin, **PAS un stablecoin**. Wrap **1:1 gratuit** par Coinbase. |
| **Lending / LLTV** | **Morpho Base**, marché **cbBTC/USDC**, **LLTV 86 %** | Le lecteur `protocol-rates` pointe ce marché — **même logique LLTV live**, seule l'adresse change. |
| **Conversion** | **QUOTIDIENNE** | Gas Base dérisoire + wrap cbBTC 1:1 gratuit → quotidien viable → **transparence on-chain quotidienne**. Le batch mensuel (motif = frais bridge) disparaît. |
| **Pool** | **Luxor** | Meilleure API data mining (per-worker hashrate, revenue, uptime, historique). **Payout Luxor en BTC** → converti en cbBTC. |
| **Rebalancing** | **Chainlink, déterministe** | Seuils/arbitrages oracle-driven, code immuable, pas de main humaine (§6.1). |
| **Accès** | **B2B / qualified, KYC-gaté** | Hérité de Sumsub + accréditation existants (§0). Allowlist on-chain = `approved` + accrédités. |

**Rail de production :** **Luxor (BTC) → Coinbase (cbBTC 1:1) → Base → collatéral.**

---

**Disclaimer.** SPEC non déployée, non auditée. Offert exclusivement à des investisseurs professionnels
/ qualifiés (B2B), KYC-gaté, sous réserve de qualification juridictionnelle, souscription minimale et
restrictions géographiques. Capital **best-effort, jamais garanti** ; performance passée ne préjuge pas
du futur. Ni une offre ni une sollicitation là où interdites.
