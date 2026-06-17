# VAULT WIRING AUDIT — câblage des données du vault dans toute la plateforme

> **Question posée.** Les infos du vault (HearstYieldVault) sont-elles affichées au bon
> endroit, bien branchées à toute l'UI (admin + client) et à tous les calculs ?
>
> **Méthode.** Audit multi-agents (35 agents, 4 surfaces : client / admin / engine / on-chain)
> + vérification adversariale de chaque problème. Date : **2026-06-17**. Lecture seule.
>
> **Verdict global.** ✅ **Câblage sain dans l'état seedé par défaut** (seul HYV-A live).
> La source de vérité est unique et propre. **20 problèmes confirmés (0 P0, 6 P1, 14 P2)** —
> aucun ne casse la démo actuelle ; ce sont surtout des **risques multi-vault** (qui ne mordent
> qu'au passage d'un 2e vault en `live`) et des **angles morts on-chain** (l'AUM affiché vient
> de la DB, pas du contrat).
>
> ---
>
> ## ✅ STATUT 2026-06-17 (post-correction) — TOUT CORRIGÉ
>
> Les **20 problèmes ont été corrigés** via squad-adrien (3 streams + 2 cycles de review),
> + **4 P1 supplémentaires** trouvés en review + **1 régression de fusion**. État final :
> **typecheck exit 0, 543 tests verts, 0 P0/P1 restant.**
>
> **Corrections livrées :**
> - **#16 (critique)** : le seed Yield stampe `contractAddress` + `network` → **le vault ne
>   disparaît plus (404) après un re-seed**. Prouvé : `pnpm db:seed` → row Yield a l'adresse réelle.
> - **#14/#17** : `totalAssets`/`convertToAssets` ajoutés à l'ABI ; `readNavPerShare()` câblé
>   **on-chain réel** sur la confirmed page (provenance "live" si lecture réussit, "estimated"
>   sinon, jamais de crash).
> - **#4/#7/#8** (admin) : AUM dual-source labellé (Reported VaultSnapshot vs Deployed principal),
>   carte On-chain (adresse + network + cross-check registre), table Share Classes A+B. **Vérifié visuellement.**
> - **#1/#10** : table de stress **paramétrée par vault** (`deriveStressRegimes`) avec clamp+renormalize
>   (plus de % négatifs, somme toujours 100) → plus de contradiction multi-vault.
> - **#2** : ticker + lockup (60/90j) **dynamiques** partout (client + admin), plus de `60` hardcodé.
> - **#11** : `riskLevel` corrigé (branche `high` atteignable, BTC-Plus classé high).
> - **#5/#6/#9/#12/#13/#18** : hurdleBps éditable, fees defaults canoniques (100/1000),
>   lockup via engine, deposit-summary relabelé "gross", liens explorer chain-aware.
>
> Le tableau §1-§2 ci-dessous décrit l'état **avant** correction (conservé pour traçabilité).

---

## 0. Ce qui MARCHE (confirmé)

- **Source de vérité unique** : `src/lib/engine/vaults.ts` (presets purs) → `prisma/schema.prisma`
  (`VaultDeployment`) → `src/lib/data/vaults.ts` (`getVault`/`listVaults`, read layer canonique).
  Admin **et** client lisent la même couche.
- **APY toujours en RANGE** (`apyLow`/`apyHigh`, composant `ApyRange` partout) — non-négociable #1 ✅
- **Provenance badges** présents et honnêtes sur chaque métrique — non-négociable #2 ✅
- **Fees, min ticket, lockup, capacity, allocations** viennent de la DB / des presets engine,
  pas de littéraux — share-class A/B canonique dans `share-class.ts`.
- **Vaults placeholder filtrés** (`isPlaceholderVault`) → le LP ne voit jamais une fausse adresse on-chain.
- **Widgets live** (yield stack, time-to-cash, lock meter, allocation donut) lisent le dernier
  `VaultSnapshot` et dégradent honnêtement en `stale`/`pending`.

---

## 1. Problèmes confirmés — P1 (6) à traiter avant multi-vault / go-live

| # | Surface | Problème | Fix |
|---|---|---|---|
| 1 | Client | **Table de stress (Bull/Bear) hardcodée au Yield vault** mais rendue sur le term sheet de TOUT vault → un Defensive 5-8% afficherait des chiffres Yield 12.8-15.2% contradictoires. `src/lib/constants/vault.ts:96-121` + `regime-scenario-table.tsx` | Paramétrer la table par vault (dériver Bull/Bear de `apyLow/High` + `targetXxxBps`) |
| 2 | Client | **Position detail hardcode ticker `HYV-A`** + page confirmed hardcode **lockup 60j** | Lire `vaultDeployment.ticker` + `getVault(id).softLockupDays` |
| 4 | Admin | **AUM admin = somme des positions DB ; LP = `VaultSnapshot`** → divergence admin↔client sur le même chiffre | Admin doit lire l'AUM via la même source (`getVault`/`listVaults`) |
| 7 | Admin | **`contractAddress` / network / registre de déploiement jamais affichés en admin** | Ajouter une carte "On-chain" (adresse + network + cross-check `getDeployment`) |
| 8 | Admin | **Share classes A+B seedées mais invisibles/non-éditables en admin** (seule la classe du deployment est montrée) | Charger `vault.shareClasses` + table de termes par classe |
| 16 | On-chain | **Le Yield Vault est filtré (404 LP) après un seed propre** car `contractAddress` null dans le seed → le vault disparaît du parcours LP | Dans `seedVaultDeployments`, stamper `contractAddress` depuis `getDeployment('vault').address` + network `84532` |

> **⚠️ #16 est le plus piégeux** : après un re-seed de la DB, le Yield Vault peut **disparaître**
> du parcours investisseur (404) parce que son adresse on-chain n'est pas seedée. À corriger
> pour que la démo survive à un reset DB.

---

## 2. Problèmes confirmés — P2 (14) — qualité / cohérence

**Admin / formulaire**
- #5 `hurdleBps` non-éditable/invisible en admin alors qu'il alimente le moteur de fees.
- #6 Defaults fees nouveau vault **200/2000 bps** = **double** du canonique SHARE_CLASS_A (100/1000).
- #9 Calcul lockup ré-implémenté inline au lieu de l'engine `lockupStatus()` ; métadonnées
  (riskLevel/baseMode/methodologyVersion) absentes du détail admin.

**Calculs / engine**
- #11 `riskLevel` : la branche `'high'` est **dead code** (ne se déclenche jamais) ; BTC-Plus
  est mal classé "moins risqué" (le calcul ne keye que sur le mining bps).
- #12 Le **net-yield engine** (`netDistributableYield`) est non-câblé : le résumé de dépôt
  ré-implémente une projection **GROSS** inline (risque d'afficher du brut comme du net).
- #13 Fallback seed `mgmtFeeBps` littéral 200 contredit le canonique class-A 100.

**On-chain (angles morts — l'app n'affiche pas l'état réel du contrat)**
- #14 **`totalAssets()` on-chain jamais lu** — l'ABI ne le déclare même pas. L'AUM affiché
  n'est jamais la vraie valeur du contrat.
- #15 Provenance **"Live" trompeuse** : l'AUM admin = somme principal DB, pas une lecture on-chain.
- #17 "NAV at entry" en dur `1.0000 USDC/share` — jamais lu on-chain.
- #18 Liens explorer en dur (`sepolia.basescan.org`) au lieu d'un helper chain-aware.
- #19 Copie "Testnet contract" du preflight contredit le registre / ne se déclenche jamais.
- #20 Provenance `manual` sur dépôt/redemption **confirmés on-chain** → sous-représente la preuve chaîne.

**Tests**
- #3 Assertion stale dans `product-select-card` test (aria-label provenance changé) — maintenance test pure.
- #10 (= #1 vu côté engine) table de stress hardcodée.

---

## 3. Lecture / priorisation

| Quand ça mord | Problèmes | Action |
|---|---|---|
| **Maintenant (1 seul vault live)** | Aucun ne casse la démo | Le câblage actuel tient |
| **Au reset DB** | #16 (Yield 404) | **Corriger avant** de re-seed pour une démo |
| **Au 2e vault `live`** | #1, #2 (contradictions term sheet) | Corriger avant multi-vault |
| **Cohérence admin↔client** | #4, #7, #8 | AUM/adresse/share-classes en admin |
| **Honnêteté on-chain** | #14, #15, #17, #20 | Lire `totalAssets()` réel + provenance correcte |
| **Calculs** | #11, #12 | net-yield engine + riskLevel correct |

**Recommandation** : traiter **#16 d'abord** (sinon une démo post-reset casse), puis le lot
on-chain (#14/#15/#17 — afficher la vraie NAV/AUM du contrat, c'est ce qui rend la démo
crédible "vrai on-chain"), puis le lot multi-vault (#1/#2/#4/#7/#8) quand un 2e vault arrive.

---

## 4. Fichiers de référence (source de vérité vault)

| Fichier | Rôle |
|---|---|
| `src/lib/engine/vaults.ts` | **Racine canonique** : 3 presets purs (Yield 8-15%, Defensive 5-8%, BTC+ 10-20%) |
| `src/lib/engine/share-class.ts` | Économie share-class canonique (A=250k/60j/100/1000, B=1M/90j/75/800) + math fees/lockup |
| `prisma/schema.prisma` | Schéma DB (`VaultDeployment`, `ShareClass`, `VaultSnapshot`, `Position`) |
| `prisma/seed.ts` | Valeurs seedées (mappe presets → rows DB) — ⚠️ voir #16 |
| `src/lib/data/vaults.ts` | **Read layer canonique** (`getVault`/`listVaults`) — la source que tout lit |
| `src/lib/onchain/vault.ts` | Lecture/écriture on-chain ERC-4626 — ⚠️ `totalAssets` absent de l'ABI (#14) |
| `config/deployments.base-sepolia.json` | Registre des adresses déployées |

---

*Audit généré le 2026-06-17 (35 agents, vérification adversariale). 20 confirmés / 0 P0.
Détail brut : voir le transcript du workflow `vault-wiring-audit`.*
