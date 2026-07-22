# DynaVault v2.1 — Backend Contract-Readiness Audit

**Date :** 2026-07-22 · **Auteur :** audit + préparation, sans déploiement
**Contrat :** `PermissionedDynaVault.sol` v2.1 — **NON déployé** (`NEXT_PUBLIC_DYNAVAULT_ADDRESS` = `TBD`)
**Sources de vérité lues :** [`docs/VAULT_SPEC_V2.1.md`](../VAULT_SPEC_V2.1.md),
[`docs/DYNAVAULT_V2_WIRING.md`](../DYNAVAULT_V2_WIRING.md), [`src/lib/chain/dynavault.ts`](../../src/lib/chain/dynavault.ts),
[`src/lib/chain/wired-view.ts`](../../src/lib/chain/wired-view.ts),
[`src/lib/chain/__tests__/no-client-chain-access.test.ts`](../../src/lib/chain/__tests__/no-client-chain-access.test.ts),
[`docs/frontend-api-only-policy.md`](../frontend-api-only-policy.md), [`docs/BACKEND_CONTEXT.md`](../BACKEND_CONTEXT.md).
`SMART_CONTRACT_INTERFACE.md` n'existe pas dans ce repo — `VAULT_SPEC_V2.1.md` en est la version
locale et fait foi (identique en contenu à la description fournie dans la mission).

**Verdict global à date de cet audit :** l'adaptateur (`dynavault.ts`) et la quasi-totalité des
routes GET/POST étaient **déjà alignées** par une passe antérieure (2026-07-15/16, cf. §9 de
`VAULT_SPEC_V2.1.md`). Cette passe a vérifié chaque ligne de cette allégation contre le code réel,
comblé les deux trous trouvés, et documenté le reste comme SUSPECT/BLOCKED.

---

## 1. Fonctions utilisateur

| Contract item | Expected backend support | Current implementation | Status | File(s) | Action required |
|---|---|---|---|---|---|
| `deposit(uint256,address)` | ABI déclarée ; pas d'appel serveur générique (write privilégié, jamais depuis un adaptateur générique) | Déclarée dans `DYNAVAULT_ABI` (user write) | OK | `src/lib/chain/dynavault.ts:404-412` | Aucune — le dépôt reste un flow wallet-signé côté client (hors scope adaptateur), jamais un write serveur |
| `redeem(uint256,address,address)` | idem | Déclarée | OK | `dynavault.ts:414-423` | Aucune |
| `redeemProportional(address)` | idem | Déclarée | OK | `dynavault.ts:425-430` | Aucune |
| Event `Deposit(user,assets,shares)` — 3 params, topic0 ≠ ERC-4626 | Signature exportée pour tout indexeur futur | `DYNAVAULT_DEPOSIT_EVENT_SIGNATURE = "Deposit(address,uint256,uint256)"` exportée, distincte de `LEGACY_DEPOSIT_EVENT_SIGNATURE` | OK | `dynavault.ts:253-258` | Aucune |
| Event `Redeem(user,shares,assets)` — renommé + réordonné | idem | `DYNAVAULT_REDEEM_EVENT_SIGNATURE` exportée | OK | `dynavault.ts:261` | Aucune |

## 2. Fonctions admin / keeper

| Contract item | Expected backend support | Current implementation | Status | File(s) | Action required |
|---|---|---|---|---|---|
| `addStrategy(address,uint256,bool)` | ABI déclarée ; pas de write helper générique (call-site audité requis) | Déclarée | OK | `dynavault.ts:781-790` | Aucune |
| `removeStrategy(address)` | idem | Déclarée | OK | `dynavault.ts:792-797` | Aucune |
| `setStrategyAllocation(uint256,uint256)` | ABI déclarée | Déclarée | OK | `dynavault.ts:717-725` | Aucune |
| `rebalance()` | route POST keeper, `requireAdmin` + kill-switch + Zod + rate-limit | `POST /api/rebalancing/execute` → `executeRebalance()` (`keeper.ts:476`) via `guardKeeperRequest` | OK | `src/app/api/rebalancing/execute/route.ts`, `src/lib/chain/keeper.ts:476` | Aucune |
| `swapAndReport(address,uint256,address,uint256,address,bytes32[])` | idem, type `bytes32[]` **SUSPECT** (voir §4) | Utilisé par `executeRebalance` (même route) | OK / **SUSPECT** (type) | `dynavault.ts:761-773` | Ne pas "corriger" le type sans confirmation contrat — documenté §4 |
| `payElectricity()` | route POST keeper | `POST /api/mining/electricity/pay` → `payElectricity()` (`keeper.ts:401`) | OK | `src/app/api/mining/electricity/pay/route.ts` | Aucune |
| `reportMiningMetrics(uint256,uint256)` | route POST keeper, Zod bornée | `POST /api/mining/metrics/report` → `reportMiningMetrics()` (`keeper.ts:359`) | OK | `src/app/api/mining/metrics/report/route.ts` | Aucune |
| `setElecPayee(address)` | ABI déclarée | Déclarée | OK | `dynavault.ts:799-804` | Aucune |
| `setMonthlyElecCost(uint256)` | idem | Déclarée | OK | `dynavault.ts:806-811` | Aucune |
| `setKeeper(address)` | idem | Déclarée | OK | `dynavault.ts:672-677` | Aucune |
| `setTvlCap(uint256)` | idem | Déclarée | OK | `dynavault.ts:679-684` | Aucune |
| `setPermissionDisabled(bool)` | idem | Déclarée | OK | `dynavault.ts:686-691` | Aucune |
| `addToWhitelist(address)` | idem | Déclarée | OK | `dynavault.ts:658-663` | Aucune |
| `removeFromWhitelist(address)` | idem | Déclarée | OK | `dynavault.ts:665-670` | Aucune |
| `setMiningNoteMode(bool)` | idem | Déclarée | OK | `dynavault.ts:855-860` | Aucune |
| `setCurtailmentThresholds(uint256,uint256)` | idem | Déclarée | OK | `dynavault.ts:813-821` | Aucune |
| `setHalvingMonth(uint256)` | idem | Déclarée | OK | `dynavault.ts:823-828` | Aucune |
| `setTakeProfitTier(uint256,uint256,uint256)` | idem | Déclarée | OK | `dynavault.ts:830-839` | Aucune |
| `resetTakeProfitTier(uint256)` | idem | Déclarée | OK | `dynavault.ts:841-846` | Aucune |
| `setProductDurationMonths(uint256)` | idem | Déclarée | OK | `dynavault.ts:848-853` | Aucune |
| `runMonthlyEngine()` | ABI déclarée ; aucune route POST dédiée (pas dans le §5 de la spec, pas demandé) | Déclarée, non exposée par une route | PARTIAL | `dynavault.ts:727-732` | Aucune — la spec §5 ne liste aucune route pour cette fonction ; ne pas en inventer une hors mission |
| `curtail()` | idem | Déclarée, non exposée par une route | PARTIAL | `dynavault.ts:734-739` | idem |
| `liftCurtailment()` | idem | Déclarée, non exposée par une route | PARTIAL | `dynavault.ts:741-746` | idem |
| `executeTakeProfit(uint256)` | idem | Déclarée, non exposée par une route | PARTIAL | `dynavault.ts:748-753` | idem |

**Note sur les 4 items PARTIAL :** la spec §5 ("Endpoints API") ne liste **aucune** route pour
`runMonthlyEngine`/`curtail`/`liftCurtailment`/`executeTakeProfit`. L'ABI les déclare (nécessaire
pour un futur call-site audité ou pour l'indexation des events qu'ils émettent), mais créer une
route POST pour elles serait **hors périmètre de la mission** (la mission liste explicitement les
endpoints keeper attendus, ces 4 fonctions n'y figurent pas). Laissé tel quel — à confirmer
explicitement si un besoin produit émerge.

## 3. Fonctions de lecture (views)

| Contract item | Expected backend support | Current implementation | Status | File(s) | Action required |
|---|---|---|---|---|---|
| `totalAssets()` | lisible legacy + v2 | `readVaultCore()` | OK | `dynavault.ts:1224-1369` | Aucune |
| `totalShares()` | v2 ; legacy via `totalSupply()` bridgé | `readVaultCore()` | OK | idem | Aucune |
| `convertToShares(uint256)` | les deux modes | `readConvertToShares()` | OK | `dynavault.ts:1418-1462` | Aucune |
| `convertToAssets(uint256)` | les deux modes | `readNavPerShare()` / `readVaultCore()` / `readUserShares()` | OK | `dynavault.ts:1373-1409`, etc. | Aucune |
| `getStrategyCount()` | v2 only | `readStrategies()` (interne) | OK | `dynavault.ts:1475-1487` | Aucune |
| `strategies(uint256)` → `(adapter, allocationBps, active, isIdle)` | v2 only, 4ᵉ composant = `isIdle` (spec §9.1, PAS `liquid`) | `readStrategies()` / `readStrategy()`, `StrategyInfo.isIdle` | OK | `dynavault.ts:1109-1120, 1465-1581` | Aucune — renommage déjà fait |
| `elecStatus()` → 5-tuple, 5ᵉ = `canPay` (PAS `isPaidThisMonth`) | v2 only | `readElecStatus()`, `ElecStatus.canPay` | OK | `dynavault.ts:1130-1142, 1630-1683` | Aucune — renommage déjà fait |
| `miningMetrics()` → 3ᵉ = `lastReportTime` | v2 only | `readMiningMetrics()` | OK | `dynavault.ts:1122-1128, 1583-1628` | Aucune |
| `shares(address)` | v2 ; legacy via `balanceOf` | `readUserShares()` | OK | `dynavault.ts:1752-1815` | Aucune |
| `whitelist(address)` | v2 only | `readWhitelist()` | OK | `dynavault.ts:1689-1745` | Aucune |
| `asset()` | les deux modes, comparé pour détecter un désaccord USDC | `readVaultCore().data.asset` | OK | `dynavault.ts:1081-1089` | Aucune |
| `keeper()` | v2 only | `readGovernance()` | OK | `dynavault.ts:1863-1902` | Aucune |
| `owner()` | v2 only (pairé avec `keeper()`, jamais seul — legacy a `owner()` mais pas `keeper()`) | `readGovernance()` | OK | idem | Aucune |
| `tvlCap()` | v2 only ; legacy → `null` explicite | `readVaultCore().data.tvlCap` | OK | `dynavault.ts:1100-1102` | Aucune |
| `permissionDisabled()` | v2 only | `readWhitelist()` | OK | `dynavault.ts:1689-1745` | Aucune |
| `miningNoteMode()` | v2 only, type `bool` **UNCONFIRMED** (spec ne donne pas de setter public du getter) | `readOpsState()` | OK / SUSPECT (type) | `dynavault.ts:571-580, 1910-1961` | Documenté inline — décode `decode_error` si uint8, ne ment jamais |
| `isCurtailed()` | v2 only | `readOpsState()` | OK | idem | Aucune |
| `currentMonth()` | v2 only | `readOpsState()` | OK | idem | Aucune |
| `reportedHashrateTh()` | v2 only (standalone getter) | ABI déclarée ; lu via `miningMetrics()` tuple, pas de call standalone dédié | PARTIAL | `dynavault.ts:596-601` | Aucune — le tuple `miningMetrics()` couvre la même donnée en 1 seul appel RPC ; dupliquer un read standalone serait un appel RPC superflu, pas un manque fonctionnel |
| `totalBtcEarnedSats()` | idem | idem | PARTIAL | `dynavault.ts:602-608` | idem |
| `monthlyElecCost()` | v2 only (standalone) | ABI déclarée ; lu via `elecStatus()` tuple | PARTIAL | `dynavault.ts:609-615` | idem — couvert par `readElecStatus()` |
| `elecPayee()` | idem | idem | PARTIAL | `dynavault.ts:616-622` | idem |
| `totalElecPaid()` | idem | idem | PARTIAL | `dynavault.ts:623-629` | idem |
| `lastElecPaymentTime()` | idem | idem | PARTIAL | `dynavault.ts:630-636` | idem |
| `vendingCurveBps(uint256)` | v2 only | `readVendingCurve()` | OK | `dynavault.ts:1818-1854` | Aucune |
| `productDurationMonths()` | v2 only | `readProductDurationMonths()` | OK | `dynavault.ts:1963-1992` | Aucune |

**Note sur les 6 items PARTIAL (standalone getters) :** ce ne sont **pas des trous fonctionnels**.
Chaque standalone getter est un sous-ensemble d'un tuple déjà lu en un seul appel RPC
(`miningMetrics()` couvre `reportedHashrateTh`/`totalBtcEarnedSats` ; `elecStatus()` couvre les 4
champs électricité). Ajouter un read dédié dupliquerait l'appel chain sans bénéfice — seul un
besoin produit de lire UN champ sans les autres justifierait de les activer. Laissé PARTIAL,
assumé.

## 4. Événements

| Event | Status | File(s) | Action required |
|---|---|---|---|
| `Deposit` (3 params) | OK — signature exportée + ABI | `dynavault.ts:253-258, 275-285` | Aucune |
| `Redeem` | OK | `dynavault.ts:261, 286-296` | Aucune |
| `StrategyAdded` | OK — ABI déclarée | `dynavault.ts:301-307` | Aucune (§9.3 comblé) |
| `StrategyRemoved` | OK | `dynavault.ts:308-311` | Aucune |
| `Rebalance` | OK | `dynavault.ts:312-317` | Aucune |
| `VaultSwapped` | OK | `dynavault.ts:318-328` | Aucune |
| `ElectricityPaid` | OK | `dynavault.ts:329-337` | Aucune |
| `ElecPayeeUpdated` | OK | `dynavault.ts:338-345` | Aucune |
| `MonthlyElecCostUpdated` | OK | `dynavault.ts:346-353` | Aucune |
| `MiningMetricsReported` | OK | `dynavault.ts:354-363` | Aucune |
| `CurtailmentTriggered` | OK | `dynavault.ts:364-372` | Aucune |
| `CurtailmentLifted` | OK | `dynavault.ts:373-380` | Aucune |
| `TakeProfitExecuted` | OK | `dynavault.ts:381-390` | Aucune |
| `MonthlyEngineRun` | OK | `dynavault.ts:391-400` | Aucune |

**BLOCKED_UNTIL_DEPLOYED — l'indexation.** Les 14 events sont déclarés dans l'ABI mais **rien ne
les ingère/persiste** (pas de listener, pas de table d'events indexés). C'est attendu et correct :
indexer des events d'un contrat non déployé n'a pas de sens. `docs/DYNAVAULT_V2_WIRING.md` §8 le
documente déjà comme travail restant, hors périmètre "prêt à recevoir le contrat" — un indexeur
est un chantier séparé qui démarre APRÈS le déploiement.

## 5. Endpoints API

| Endpoint | Méthode | Status | File(s) | Action required |
|---|---|---|---|---|
| `/api/dashboard` | GET | OK | `src/app/api/dashboard/route.ts` | Aucune — `requireAuth` + rate-limit + 4 blocs `Wired<T>` indépendants |
| `/api/vault` | GET | OK | `src/app/api/vault/route.ts` | Aucune |
| `/api/vault/strategies` | GET | OK | `src/app/api/vault/strategies/route.ts` | Aucune |
| `/api/strategies/[index]` | GET | OK | `src/app/api/strategies/[index]/route.ts` | Aucune — Zod sur le param d'URL |
| `/api/rwa-vault` | GET | OK | `src/app/api/rwa-vault/route.ts` | Aucune |
| `/api/rebalancing/status` | GET | OK | `src/app/api/rebalancing/status/route.ts` | Aucune — `requireAdmin` (surface admin) |
| `/api/mining/metrics` | GET | OK (stub honnête, Antpool absent) | `src/app/api/mining/metrics/route.ts` | Aucune — `not configured`, jamais de valeur fake |
| `/api/mining/metrics/onchain` | GET | OK | `src/app/api/mining/metrics/onchain/route.ts` | Aucune |
| `/api/mining/electricity` | GET | OK | `src/app/api/mining/electricity/route.ts` | Aucune |
| `/api/product/factsheet` | GET | OK | `src/app/api/product/factsheet/route.ts` | Aucune |
| `/api/backtest/historical` | GET | **MISSING** | — | **Créée cette passe** (§6) : `not_available` honnête, aucune donnée fake |
| `/api/mining/metrics/report` | POST (keeper) | OK | `src/app/api/mining/metrics/report/route.ts` | Aucune — `requireAdmin` + kill-switch + Zod bornée + rate-limit(10) |
| `/api/mining/electricity/pay` | POST (keeper) | OK | `src/app/api/mining/electricity/pay/route.ts` | Aucune — idem + body vide strict |
| `/api/rebalancing/execute` | POST (keeper) | OK | `src/app/api/rebalancing/execute/route.ts` | Aucune — Zod complète (adresses, uint256, swapData bornée) |
| `/api/rwa-vault` | POST (keeper) | OK — 501 honnête | `src/app/api/rwa-vault/route.ts` | Aucune — la spec §2 n'a pas de fonction contrat correspondante ; refuse proprement |
| `/api/btc-deposit/initiate` | POST (keeper) | OK — 501 honnête | `src/app/api/btc-deposit/initiate/route.ts` | Aucune — idem, aucune fonction contrat §2 ne correspond |
| `/api/btc-deposit/complete` | POST (keeper) | OK — 501 honnête | `src/app/api/btc-deposit/complete/route.ts` | Aucune |

**Le seul vrai MISSING de toute la matrice était `/api/backtest/historical`.** Corrigé cette passe
(§6 ci-dessous).

## 6. Corrections apportées cette passe

1. **`GET /api/backtest/historical`** — route créée. Le contrat v2.1 n'a aucune fonction de
   backtest (c'est un calcul applicatif, pas un read chain) ; la route renvoie donc un état
   honnête `unavailable` / `not_available` avec un motif clair plutôt qu'une donnée inventée ou un
   404 muet. `requireAuth` + rate-limit, cohérent avec les autres GET du domaine.
2. **`src/lib/ds/__tests__/ds-authority-lock.test.ts`** — cassé par un nettoyage de repo antérieur
   (référence à un fichier de règles supprimé), corrigé dans une passe précédente, sans lien avec
   DynaVault — mentionné ici pour mémoire de session, pas un item de cette matrice.
3. **Test readiness ABI/routes** — voir §7.

## 7. Tests ajoutés/renforcés

- `src/app/api/backtest/historical/__tests__/route.test.ts` (nouveau) — auth, rate-limit,
  `unavailable`/`not_available` honnête, jamais de fixture.
- Couverture ABI/mode déjà **complète** avant cette passe (`src/lib/chain/__tests__/dynavault.test.ts`,
  982 lignes) : 12 events + 10 fonctions owner/keeper + tous les renommages (§9.1/§9.2/§9.3)
  vérifiés par des `it()` dédiés. Rien à dupliquer.
- `no-client-chain-access.test.ts` déjà vert (0/133 composants client n'importent la chaîne).

## 8. SUSPECT — non corrigés silencieusement

| Item | Nature du doute | Action |
|---|---|---|
| `swapAndReport(...)` 6ᵉ param `bytes32[] swapData` | La spec type `bytes32[]`, très probablement un `bytes` (calldata de swap) en réalité | **Non modifié.** Déclaré exactement comme la spec, avec commentaire `@todo Confirm with the contract engineer`. Un mauvais type ferait échouer l'appel au revert, jamais silencieusement. |
| `SHARE_DECIMALS` v2 = 6 | La spec dit "1:1 initially" sans préciser l'unité ; `V2_SHARE_DECIMALS = 6` est une **inférence** (asset 6 déc., pas d'ERC-4626 `_decimalsOffset`), non vérifiée contre le bytecode | **Non modifié.** Marqué `@todo Reconfirm against the DEPLOYED bytecode`. Si faux, `navPerShare` serait décalé d'un facteur 1e12 — visible via `shareDecimals` renvoyé sur chaque read, jamais caché. |
| `miningNoteMode()` type `bool` | Spec ne donne aucun setter ni signature confirmée | **Non modifié.** Si le contrat retourne un uint8, le decoder renvoie `decode_error`, jamais une valeur devinée. |
| USDT (spec §1/§3) vs USDC (spec §7, tranché Adrien 2026-07-15) | Contradiction interne à la spec fournie | **Backend reste USDC.** Vérifié : zéro occurrence de `USDT` dans `src/lib/chain` ou `src/app/api` (recherche §Phase 7 ci-dessous). `asset()` reste lu on-chain pour rendre observable tout désaccord futur. |
| B2 = solde LBTC par stratégie | Spec §5 promet un solde LBTC par poche, spec §3 (`strategies()`) ne rend qu'une allocation **cible**, pas un solde réel | **Contradiction interne à la spec, pas un bug applicatif.** `api/rwa-vault` renvoie honnêtement `not_exposed_by_contract` pour ce champ plutôt que de faire passer la cible pour un solde. À résoudre côté contrat. |

## 9. BLOCKED_UNTIL_DEPLOYED

| Item | Pourquoi bloqué |
|---|---|
| Vérification de l'ABI contre le bytecode réel | Le contrat n'existe pas — chaque marqueur `UNCONFIRMED` (`swapAndReport`, `miningNoteMode`, `V2_SHARE_DECIMALS`) ne peut être tranché qu'après déploiement |
| Indexation des 14 events | Un indexeur qui écoute un contrat non déployé n'a rien à indexer ; chantier séparé, démarre après déploiement |
| Tout write keeper réel (`rebalance`, `payElectricity`, `reportMiningMetrics`, etc.) | `KEEPER_ENABLED=0` par défaut ; même activé, `KEEPER_PRIVATE_KEY` absent en dev ; les routes refusent fail-closed sans jamais tenter de signer sur un contrat qui n'a pas la fonction |
| `runMonthlyEngine` / `curtail` / `liftCurtailment` / `executeTakeProfit` en tant que routes API | Non listées dans la spec §5 ; ABI prête, pas de call-site — décision produit à prendre séparément si un besoin apparaît |

## 10. Ce qui reste à trancher (hors périmètre "sans déploiement")

- `bytes32[]` vs `bytes` pour `swapAndReport` — nécessite l'ingénieur contrat ou le bytecode déployé.
- `SHARE_DECIMALS` v2 (6 vs autre) — nécessite le bytecode déployé.
- Type réel de `miningNoteMode()` — nécessite la source ou le bytecode du contrat.
- Décision produit sur `runMonthlyEngine`/`curtail`/`liftCurtailment`/`executeTakeProfit` en routes API dédiées, si un besoin émerge.
