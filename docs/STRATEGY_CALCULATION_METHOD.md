# Méthode de calcul de la stratégie — Hearst Vault

> Référence consolidée de la méthode qui transforme les données marché (prix
> machines Telegram, hashprice, yields) en **APY range par vault**. Tous les
> modules sont purs (`src/lib/telegram/*`), sans I/O, testés (54 tests).

## Vue d'ensemble

```
Telegram (Letine)  →  prix machines + fabricant + cooling + J/TH
       ↓
cost-model         →  landed (ex-works + port $100 + douane/pays) → CAPEX + énergie 6¢
       ↓
strategy-model     →  markup société + revenue-share → yield LP mining
       ↓                                    ↓
hashprice live          usdc-yield (meilleur pool, rebalance net frais)
(mempool+coingecko)              ↓
       ↓              BTC collatéral (LTV 40-60%, ~37.5% marge liquidation)
       └──────────────────┬─────────────────┘
                          ↓
              allocator (3 buckets, risk-adjusted, dérivé)
                          ↓
              vault-apy → APY RANGE par vault (low/high + assumptions + disclaimer)
```

## Les 3 buckets (allocation dérivée, pas figée)

| Bucket | Rôle | Module |
|---|---|---|
| **Mining** | Produit du BTC (cashflow + sats HODLés) | `strategy-model.ts` |
| **BTC** | BTC acheté/miné, capture l'appréciation (x2/x3) | stratégie LTV |
| **USDC** | Yield stable DeFi + coussin | `usdc-yield.ts` |

L'allocation est **calculée** (`allocator.ts`), pas fixée : score Sharpe-like par
bucket (rendement / risque), poids = scores normalisés. Plus le potentiel BTC
monte, plus son poids monte ; USDC = refuge quand BTC plat. Bornes par profil de
vault (Defensive cappe BTC).

## 1. Bucket Mining

```
prix_revient (Letine)  + markup société %  = prix_facturé
landed = prix_facturé + port $100 + douane(pays)
CAPEX $/TH/jour = landed / TH / (amort_mois × 30,4)   # air 36, hydro/imm 60
énergie $/TH/jour = (J/TH × 24 / 1000) × 0,06 × 0,98   # 6¢/kWh fixe
revenu (hashprice live) = block_reward×144×BTC / network_hashrate
revenu_net = hashprice − énergie − CAPEX
part_société = max(0, revenu_net) × revenue_share%
yield_LP_mining = revenu_net − part_société
yield% annualisé = (yield_LP × 365) / (landed/TH) × 100
```

Deux leviers société : **markup** (le "pont" sur la vente machine) + **revenue-share**
(% du revenu net). Specs J/TH Bitmain depuis `manufacturer-catalog.ts` (Letine ne
les imprime pas).

## 2. Bucket BTC — collatéral, LTV 40-60% (synthèse panel 10 Opus)

Le BTC (miné + acheté = stack commun) sert de collatéral pour emprunter l'USDC qui
paie l'électricité. **Invariant** : la dette finance UNIQUEMENT l'OPEX ; les
distributions viennent UNIQUEMENT du cash mining ; on vend du BTC seulement pour
survivre.

```
LTV = dette_USDC / (stack_BTC × prix_BTC)
vendre pour désendetter : x = (D − L·C) / (1 − L)
emprunter pour racheter : y = (L·C − D) / (1 − L)
```

| Seuil | Action |
|---|---|
| 0.55 | Trim pré-emptif vers 0.50 |
| 0.58 | Buffer : au-dessus, payer l'élec depuis la réserve |
| **0.60 (cap)** | Vente forcée → 0.55 (1er touch) / 0.50 (confirmé) |
| 0.50→0.40 | Rachat LIFO du BTC vendu, à prix ≤ prix de vente |
| 0.825 | Liquidation prêteur — on se désendette ~37.5% AVANT |

## 3. Bucket USDC

Plusieurs venues (Morpho + autres via DeFiLlama). On prend le **meilleur yield à
l'instant T** ; on ne switche que si le gain net de frais de transfert > 0 sur la
fenêtre de payback (`usdc-yield.ts`). Filtre TVL floor anti pool douteux.

## Composition finale → APY range (`vault-apy.ts`)

```
allocation = allocate(mining, btc_base, usdc)   # poids vue centrale
borrow_drag = borrow_apr × avg_ltv × poids_btc  # toujours soustrait
APY(scenario) = Σ(poids × yield_bucket) − borrow_drag − frais
apyLow  = min(APY_bear, APY_bull)
apyHigh = max(APY_bear, APY_bull)
```

- **Toujours un RANGE**, jamais un point (non-négociable #1).
- BTC = bande scénario bear/base/bull (l'input le plus incertain pilote le spread).
- Coût d'emprunt toujours soustrait (jamais de levier qui gonfle le headline).
- Assumptions + disclaimer "not guaranteed" (#10).

Exemple (mining 8% / USDC 5% / BTC -20/+40/+120 / borrow 6%@50% / frais 2%) :

| Vault | Alloc (mining/BTC/USDC) | APY range |
|---|---|---|
| Yield | 9 / 25 / 66 | -3.6% → +30.7% |
| Defensive | 10 / 15 / 75 | -0.9% → +20.1% |
| BTC-Plus | 7 / 40 / 53 | -8% → +48% |

## Provenance & honnêteté

Chaque chiffre porte sa provenance (Live/Oracle/Attested/Estimated/Manual/Stale).
Le yield mining se décompose en deux lignes badgées séparément : coin-count (sats,
Estimated→Attested) et price-effect (mark, Oracle). Aucun mot interdit
(guarantee/promise/certain/will deliver/risk-free).

## Fichiers

`src/lib/telegram/` : `parse-machine-price` · `model-catalog` ·
`manufacturer-catalog` · `cost-model` · `strategy-model` · `allocator` ·
`usdc-yield` · `vault-apy` · `read-machines` (loader serveur).
Données live réutilisées : `src/lib/data/{hashprice,defillama,btc-price}.ts`.
