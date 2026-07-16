# Hearst Vault v2 — Matrice de conformité smart contract

**Généré :** 2026-07-16 (PROMPT 216, mode quick, exécution réelle)
**Canon :** [`docs/VAULT_SPEC_V2.1.md`](VAULT_SPEC_V2.1.md) (v2.1) — la spec `SMART_CONTRACT_INTERFACE.md`
nommée par le prompt **n'existe pas** dans le repo ; son équivalent canonique est VAULT_SPEC_V2.1.md.
**Contrat :** `contracts/src/PermissionedDynaVault.sol` (889 lignes, Foundry — pas Hardhat).
**Réseau :** Base Sepolia (84532). **Aucun mainnet.**

> **Statut runtime au moment de l'audit :** contrat **écrit + testé (44/44) mais NON DÉPLOYÉ**.
> `NEXT_PUBLIC_DYNAVAULT_ADDRESS` absente → l'app tourne en **mode `legacy`** sur l'ancien
> HearstYieldVault ERC-4626 (déployé, `0x2bd14d…329e`). Le DynaVault v2 est **dormant**.

---

## Fix appliqué cette passe (quick win débloquant)

**P0 — build contrat cassé → réparé.** Le contrat, ses tests et le script de déploiement importaient
`src/adapters/{IStrategyAdapter,BaseStrategyAdapter,USDCMiningAdapter,LBTCPouchAdapter,USDCReserveAdapter}.sol`,
mais ces 5 fichiers **n'existaient que dans un worktree agent orphelin** (`agent-ab291cd7b6ccee663`,
untracked, jamais rapatrié). `forge build` échouait sur `Source not found`. → **Adapters rapatriés dans
`contracts/src/adapters/`.** Résultat : `forge build` OK, `forge test --match-contract PermissionedDynaVault`
= **44 passed / 0 failed**.

---

## Matrice

| Domaine | Spécification | Implémentation | Tests | Runtime | Statut | Action |
|---|---|---|---|---|---|---|
| **Contrat (build)** | PermissionedDynaVault + 5 adapters | `PermissionedDynaVault.sol` + `adapters/*` (rapatriés) | `forge build` OK | Compile | **PASS** | — |
| **Fonctions utilisateur** | `deposit`/`redeem`/`redeemProportional` | Implémentées, accounting 6-déc, mint/burn, events | 44 tests (genesis 1:1, cap, whitelist, idle-first, round-trip) | Testé local | **PASS** | — |
| **Stratégies (gestion)** | `addStrategy`/`removeStrategy`/`setStrategyAllocation`/`rebalance`/`swapAndReport` | Implémentées, `onlyOwner`/`onlyKeeper` | rebalance restore weights, remove repatriates funds | Testé local | **PASS** | — |
| **Layout Mining Note** | B1 4000 non-idle · B2 2700 non-idle · B3 3300 idle · exactement 3 | `_enforceMiningNoteLayout` impose ordre+bps on-chain | rejette 4e strat, poids exacts, cas invalides | Testé local | **PASS** | — |
| **B1 — Mining Power (40%)** | adapter non-idle, mining yield | `USDCMiningAdapter` = **stub USDC** (invest no-op, totalAssets=solde) ; mining rapporté off-chain via `reportMiningMetrics` | couvert par tests vault | Stub testnet honnête | **STUB** | Adapter production (RWA/oracle) = passe ultérieure auditée |
| **B2 — BTC Pouch (27%)** | LBTC, oracle, swap, upside BTC | `LBTCPouchAdapter` = **USDC stand-in** ; PAS de token LBTC/oracle/router ; swaps via keeper `swapAndReport` off-chain | couvert | Stub (LBTC de nom seulement) | **STUB** | Contradiction spec §5 (solde LBTC) vs §3 (aucun solde/strat) — à résoudre côté contrat |
| **B3 — Reserve (33%)** | idle in vault, USDC, élec/DCA/exit | Traité idle via `adapter==address(0)`, satisfait par le solde USDC propre du vault ; `USDCReserveAdapter` = placeholder tests non câblé au deploy | couvert | Idle réel (pas de faux adapter) | **PASS** | — |
| **Rebalancing** | overweight/underweight/no-op tolérance | `rebalance`/`_rebalance`, `onlyKeeper`, nonReentrant | restore target weights | Testé local | **PASS** | — |
| **Electricity** | `payElectricity`/`setElecPayee`/`setMonthlyElecCost`/`elecStatus`, cooldown 30j | Implémentées, `InsufficientIdle`/`ElecCooldownActive`/`ElecPayeeUnset`, `totalElecPaid` | cooldown, payee-unset, keeper-only | Testé local | **PASS** | — |
| **Mining metrics** | `reportMiningMetrics`/`miningMetrics`/hashrate/sats | Implémentées, keeper-only, accumulation sats, `lastReportTime` | accumulation, access control | Testé local | **PASS** | — |
| **Monthly Engine** | `runMonthlyEngine`/`vendingCurveBps`/`setProductDurationMonths` | Implémentées | month increment, vending curve boundaries, duration | Testé local | **PASS** | — |
| **Curtailment** | `curtail`/`liftCurtailment`/`setCurtailmentThresholds`/`setHalvingMonth` | Implémentées, seuils pré/post-halving | trigger low-price, lift, block B1 alloc | Testé local | **PASS** | — |
| **Take-profit** | `executeTakeProfit`/`setTakeProfitTier`/`resetTakeProfitTier` | Impl **stub accounting** : déplace proceeds modélisés B2→idle, tier once, event | tier-unset revert, sells-into-idle, reset | Testé local | **PARTIAL** | Pas de prix BTC on-chain / token BTC / router réel — accounting modélisé (assumé testnet) |
| **Vending curve** | `1 - month/total` | `vendingCurveBps` sur `productDurationMonths` | boundaries | Testé local | **PASS** | — |
| **API (16 endpoints)** | 11 public + 6 keeper | 15 présents, gate `guardKeeperRequest`+kill-switch+Zod strict, lectures on-chain réelles | — | Legacy → `not_supported_by_legacy` honnête | **PARTIAL** | `GET /api/backtest/historical` **MISSING** (aucun appelant) |
| **API sécurité** | auth mutantes, KEEPER_PRIVATE_KEY gardé | 6 POST gatés, 0 UNSAFE ; clé fail-closed (`key_missing`→503) ; `KEEPER_ENABLED` défaut OFF | — | Écritures bloquées tant que kill-switch OFF | **PASS** | — |
| **Frontend** | surfaces investisseur + admin sur interface v2 | Surfaces LIVE alignées : USDC, 40/27/33, `isIdle`/`canPay`, 0 import cassé, 0 fetch client | typecheck app OK (exit 0) | Rend en mode legacy (états unavailable honnêtes) | **PASS** | — |
| **Frontend (sandbox)** | — | `/portfolio/preview` mock = **40/37/23** + modèle Morpho (LLTV/liquidation) caduc v2 | — | Firewallé (seul `preview/*` l'importe) | **LEGACY** | Sandbox "Portfolio preview V4" connu, non-committé — aligner OU marquer "pré-v2" (non touché : direction cible) |
| **Déploiement** | Base Sepolia, 8 params | Script `DeployDynaVault.s.sol` **100% conforme** (40/27/33, élec 16408, curtail 35968/72318, halving 21, durée 24) mais **jamais exécuté** | — | Aucun broadcast DynaVault ; seul legacy on-chain | **MISSING** (deploy) | Provisionner env + `forge script --broadcast` + remplir config + set env (passe dédiée, hors quick) |
| **Docs** | VAULT_SPEC_V2.1 = source de vérité | §9 = journal de rattrapage à jour (USDC tranché, décimales v2=6, renames, ABI complétée, allocs vérifiées) | — | Aligné code | **PASS** | §9.4 périmée (btc-deposit POST existent désormais) — micro-correction doc optionnelle |
| **Sécurité contrat** | owner/keeper-only, reentrancy, zero-addr, alloc invalide | `onlyOwner`/`onlyKeeper`, `nonReentrant`, `ZeroAddress`/`AllocationTooHigh`/`MiningNoteLayoutViolation` | owner-only, keeper-only, zero-addr, invalid-alloc | Testé local | **PASS** | Adapters/router non audités (Spearbit avant mainnet — ADR-006) |

---

## Décision USDT / USDC

**Tranché : asset = USDC.** (Adrien, 2026-07-15, acté `dynavault.ts:23-28` + spec §9.0). Le mot « USDT »
de la spec d'origine est **caduc**. USDC 6 décimales, Base Sepolia `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
Les 47 occurrences « USDT » dans `src/` sont **hors périmètre vault** (paires Binance `BTCUSDT`, panneau
stablecoin Chainlink admin) — aucune ne présente USDT comme asset du vault.

## Décision décimales shares

**Tranché dans le code : 6 décimales en v2** (`V2_SHARE_DECIMALS = 6`, pas d'offset 1e12 — ce n'est pas
un ERC-4626). Legacy reste 18 (mode-aware). La spec §9.0 le disait "non tranché" — **c'est désormais
résolu dans le code** (`ce8a1487`), la doc §9 le confirme. Aucun risque de NAV/share faux d'un facteur 1e12.

## Ancien moteur (legacy)

Scenario engine v1.0 4-sleeves **rasé** (main `fd460e16`, confirmé). Grep des 13 termes legacy → 3 hits,
**tous vivants et bénins** (commentaire garde-fou memo, label doc mdx, nœud d'archi affiché, préfixe
`runVaultHitlDiagnostics` routé). **Rien de mort à supprimer.** `src/lib/product-strategies/` (4-sleeves)
= **produit distinct vivant** (routé `/admin/strategies`), pas le vault note — ne pas confondre.

## Ce qui n'a PAS pu être vérifié

- **Comportement on-chain réel** : le contrat n'est pas déployé → tout est prouvé par tests Foundry
  locaux (44/44), pas par transaction testnet.
- **Vérification Basescan** du legacy : `sourceMatchesCommitted` compare au commit git, pas à l'explorer.
- **`swapAndReport` encodage** (`bytes32[]` vs `bytes`) : levé seulement par bytecode déployé.
- **Adapters production** (LBTC oracle/swap) : inexistants — stubs testnet uniquement.
