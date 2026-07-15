# Câblage DynaVault v2 — état du chantier

**Date** : 2026-07-15 · **Chaîne** : Base Sepolia (`chainId` 84532) — aucune mainnet nulle part.
**État des lieux complet** : [`docs/CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md`](CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md)

---

## 1. En une phrase

Le code qui parle à `PermissionedDynaVault` v2.1 est écrit ; **le contrat, lui, n'est pas
déployé**. L'app tourne donc aujourd'hui en mode `legacy` sur l'ancien vault ERC-4626, et
tout ce que le legacy ne sait pas faire s'affiche comme **indisponible avec son motif** —
jamais comme une valeur de repli.

---

## 2. Ce qui est branché, et ce qui ne l'est pas

### Branché aujourd'hui

- **L'adaptateur** `src/lib/chain/dynavault.ts` — le point de passage **unique** entre l'app
  et le vault. Aucun autre module n'a le droit de déclarer une ABI de vault, de résoudre une
  adresse de vault, ou de décoder un tuple de vault. Quand le contrat rechangera, **seul ce
  fichier changera**.
- **Le contrat d'honnêteté** `Wired<T>` — toute lecture renvoie soit une donnée lue sur un
  contrat nommé, à une adresse nommée, à un instant nommé, soit un `unavailable` avec un
  motif. Il n'y a pas de troisième état.
- **Les primitives UI** `WiredChip` / `WiredValue` (`src/components/ui/`) — rendent un
  `Wired<T>` sans jamais fabriquer de valeur.
- **Le sous-ensemble commun**, lisible sur le vault legacy réellement déployé
  (`0x2bd14d52518a04f4c12949c51df03a161a9e329e`) : `totalAssets()`, `totalSupply()`
  (→ `totalShares`), `convertToAssets()`, `asset()`, `balanceOf()` (→ `shares`), `paused()`.

### Pas branché — et pourquoi

- **Le contrat cible n'existe pas.** `PermissionedDynaVault` v2.1 n'est **pas déployé** :
  toutes les adresses de la spec sont **TBD**. Tant que c'est vrai, les stratégies, le mining,
  l'électricité, la whitelist, le `tvlCap`, le curtailment et la courbe de vending renvoient
  `unavailable` / `not_supported_by_legacy`.
- **L'ABI v2.1 n'est pas vérifiée contre du bytecode.** Elle est transcrite depuis la spec.
  Chaque marqueur `UNCONFIRMED` dans `dynavault.ts` est une **inférence** à faire confirmer
  par l'ingénieur contrat avant tout déploiement.
- **`SHARE_DECIMALS` n'est pas confirmé pour la v2.** Le legacy est à 18 (vérifié on-chain).
  La spec v2.1 dit « 1:1 initialement » sans dire *1:1 en quelle unité*. Si la v2 ship des
  shares à 6 décimales, **la constante doit passer à 6**, sinon le NAV par share est faux d'un
  facteur 1e12 — et l'erreur est **silencieuse**.

---

## 3. Comment allumer la v2

Une seule variable :

```bash
# .env.local
NEXT_PUBLIC_DYNAVAULT_ADDRESS="0x…"   # adresse du DynaVault v2.1 déployé
```

Poser cette adresse fait basculer l'adaptateur de `legacy` à `v2`, et **tout s'allume** : la
surface complète v2.1 devient lisible, et les valeurs concernées passent en bleu dans l'UI.

> ⚠️ **Rebuild obligatoire.** `NEXT_PUBLIC_*` est inlinée dans le bundle client **au build**,
> pas au runtime. Poser la valeur et redémarrer ne suffit pas côté navigateur.

---

## 4. Les trois modes

| Mode | Déclencheur | Ce qui est lisible | Ce qui renvoie `unavailable` |
|---|---|---|---|
| **`v2`** | `NEXT_PUBLIC_DYNAVAULT_ADDRESS` posée **et** bien formée | Toute la surface v2.1 (sous réserve que l'ABI corresponde vraiment au bytecode) | Ce qui revert ou décode mal → motif explicite (`revert`, `decode_error`) |
| **`legacy`** | Pas d'adresse v2, mais `NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS` (ou l'alias `NEXT_PUBLIC_HEARST_VAULT_ADDRESS`) posée | Sous-ensemble commun **uniquement** : `totalAssets`, `totalShares` (via `totalSupply`), `convertToAssets`, `asset`, `shares` (via `balanceOf`), `paused` | Tout le reste → `not_supported_by_legacy` |
| **`not_configured`** | Aucune adresse | Rien | Tout → `not_deployed` |

**Le motif compte autant que l'état.** Le vocabulaire est fixé dans `UNAVAILABLE_REASONS` :

| Motif | Sens exact |
|---|---|
| `not_deployed` | Aucune adresse configurée : la donnée **n'existe pas encore**. |
| `not_supported_by_legacy` | L'ancien contrat n'expose simplement pas cette lecture. |
| `rpc_error` | **Une panne.** Le nœud n'a pas répondu. Ce n'est **pas** une absence de donnée. |
| `revert` | Le RPC a marché, le contrat a dit non (ou la fonction n'existe pas à cette adresse). |
| `decode_error` | La chaîne a répondu une forme qui ne correspond pas à notre ABI. |
| `invalid_input` | Argument hors bornes : rien n'a été envoyé. |

Cette distinction **panne ≠ absence** est le non-négociable central du repo. Comparez toujours
contre les constantes `UNAVAILABLE_REASONS`, jamais contre un littéral (une faute de frappe
dans une comparaison de string ne matche jamais, silencieusement).

---

## 5. La convention bleue

> **Bleu = la donnée vient du nouveau contrat / des routes v2.**

C'est un instrument de **chantier**, pas un nouveau `kind` de provenance. Le vocabulaire de
provenance (Live / Oracle / Attested / Estimated / Manual / Stale) est un non-négociable
produit et **n'est pas touché** : y ajouter « branché » demanderait un ADR. `WiredChip` répond
à une question différente et temporaire, et disparaîtra avec le chantier — supprimer
`wired-chip.tsx` / `wired-value.tsx` n'entame pas le langage de provenance.

**Tokens** : `var(--ct-status-info)` (#60a5fa) et `var(--ct-status-info-soft)`, qui existent
déjà. Alias Tailwind : `text-info`, `bg-info`, `border-info`. **Aucun nouveau token, aucun hex.**

**Où Adrien le verra** — trois rendus, et un seul est bleu :

| État | Rendu | Libellé |
|---|---|---|
| `wired` | **Bleu plein**, point plein | « Branché v2 » — ou « Branché (legacy) » si la valeur sort de l'ancien contrat |
| `pending` | Bleu atténué, point creux | « En attente de déploiement » |
| `unavailable` | **Neutre — jamais bleu**, pas de point | Le motif, en clair (« Lecture chaîne indisponible », « Contrat non déployé », …) |

La couleur ne porte **jamais** le sens seule : le libellé texte le porte, la couleur l'appuie.
Une lecture qui n'aboutit pas rend un em-dash muet + son motif — jamais `0`, jamais `N/A`.

Aujourd'hui, en mode `legacy`, ce qu'Adrien voit en bleu doit être **exactement** le
sous-ensemble commun du §4, étiqueté « Branché (legacy) ». Tout bleu « Branché v2 » avant le
déploiement du contrat serait un bug.

---

## 6. Les routes

**Honnêteté d'abord** : au moment où cette page est écrite, les routes du chantier (~11 GET de
lecture + 3 POST keeper) **ne sont pas encore sur le disque** — elles atterrissent dans le même
passage, écrites par d'autres agents. **Je ne connais donc pas leurs chemins exacts et je ne
les invente pas ici.** Ce §6 fixe le **contrat** que chacune respecte ; l'intégrateur complète
la colonne « chemin » avec les fichiers réellement livrés (`src/app/api/**/route.ts`).

### Contrat commun — routes GET (lecture)

| Aspect | Règle |
|---|---|
| **Auth** | `requireInvestor(from)` pour les surfaces LP, `requireAdmin()` pour les surfaces admin. Une route publique volontaire porte un commentaire `// PUBLIC:` explicite. |
| **Ce qu'elle renvoie** | Un `Wired<T>` sérialisé, tel quel : `status`, et selon le cas `data`/`source`/`address`/`chainId`/`readAt`, ou `reason`/`detail`. Aucune donnée nue sans son enveloppe. |
| **État en legacy** | `status: "wired"` + `source: "legacy"` pour le sous-ensemble commun. Tout le reste : `status: "unavailable"`, `reason: "not_supported_by_legacy"`. **Jamais un 500, jamais un zéro.** |
| **État sans adresse** | `status: "unavailable"`, `reason: "not_deployed"`. |
| **Panne RPC** | `status: "unavailable"`, `reason: "rpc_error"` — distinct des deux lignes ci-dessus, c'est tout l'intérêt. |
| **Erreurs** | Log serveur ; réponse générique `{ error: 'Internal error' }` 500. Jamais `e.message` au client. |

### Contrat commun — routes POST keeper

Les trois opérations keeper de la spec sont `rebalance()`, `payElectricity()` et
`reportMiningMetrics()`. Chacune est une action **privilégiée qui déplace de la valeur**.

| Aspect | Règle |
|---|---|
| **Auth** | `requireAdmin()` **avant tout accès DB/chaîne**. Fail-closed : pas de gate, pas de route. |
| **Kill-switch** | `KEEPER_ENABLED` ≠ `1` → refus immédiat, sans toucher la chaîne. Défaut **OFF**. |
| **Clé** | `KEEPER_PRIVATE_KEY`, **server-only**. Absente → indisponible, même si `KEEPER_ENABLED=1`. |
| **Validation** | Schéma **Zod** (type + bornes + enums), sinon 400. Jamais `await req.json() as T`. |
| **Rate limit** | `assertRateLimit(key, max, windowMs)` sur chaque mutante. |
| **État en legacy / sans adresse** | Refus honnête (`not_supported_by_legacy` / `not_deployed`). Aucune signature n'est tentée sur un contrat qui n'a pas la fonction. |
| **Interdit** | Aucun de ces appels n'est exposé au chat, jamais (ADR-012 / ADR-017). ⚠️ **Tension à trancher** : ADR-018 dit qu'une crew ne détient jamais de clé et ne signe jamais — un keeper automatique qui signe est en tension directe avec cette ligne rouge, à arbitrer explicitement (ADR-019). |

---

## 7. Les pièges connus — noir sur blanc

### 7.1. L'event `Deposit` de la v2.1 n'a pas la signature ERC-4626

La spec déclare :

```
Deposit(address indexed user, uint256 assets, uint256 shares)      ← 3 paramètres
```

Le standard ERC-4626 déclare :

```
Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)   ← 4
```

**Arité différente ⇒ topic0 différent.** Un indexeur, un subgraph ou un filtre `getLogs` écrit
contre la signature standard matche **zéro** dépôt v2. Les deux signatures sont exportées de
`dynavault.ts` (`DYNAVAULT_DEPOSIT_EVENT_SIGNATURE` / `LEGACY_DEPOSIT_EVENT_SIGNATURE`) —
utilisez-les, ne les retapez pas.

Même piège sur la sortie : la v2.1 remplace `Withdraw(sender, receiver, owner, assets, shares)`
par `Redeem(address indexed user, uint256 shares, uint256 assets)` — **renommé ET réordonné**
(shares avant assets).

Et plus généralement : **PermissionedDynaVault v2.1 n'est pas un ERC-4626.** Noms familiers,
surface divergente — `totalShares()` remplace `totalSupply()`, `shares(address)` remplace
`balanceOf(address)`, `previewDeposit` / `maxRedeem` / `previewRedeem` sont absents de la spec.
Un client écrit contre le standard ne voit **rien**, sans erreur.

### 7.2. `bytes32[] swapData` est probablement un `bytes`

La spec type ce paramètre `bytes32[]`. C'est très probablement un `bytes` (calldata de swap).
**À confirmer auprès de l'ingénieur contrat** avant tout appel : un mauvais type ne se voit
pas à la compilation, il se voit au revert.

### 7.3. La spec dit « USDT » — c'est faux, c'est **USDC**

La spec dit « USDT » en §1/§3 et « USDC » en §7. **Tranché par Adrien : c'est USDC** (6
décimales). Le vault déployé pointe bien sur USDC Base Sepolia
(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). **Le mot « USDT » n'apparaît nulle part dans
ce codebase, volontairement.** `asset()` est malgré tout lu sur la chaîne et exposé dans
`VaultCore.asset` : un désaccord doit être **observable**, pas supposé.

### 7.4. Le min ticket est à **1 USDC** — c'est un réglage de chantier

`MIN_TICKET_USDC=1` (décision Adrien, « pour l'instant »), aligné sur le legacy dont
`minDeposit()` vaut réellement 1 USDC on-chain. **À remettre à 250000 avant tout LP réel.**

### 7.5. Le lock-up 60j et le min ticket ne sont **pas dans le contrat v2**

Ce sont des règles **applicatives**. Elles vivent dans l'app, pas dans le bytecode — donc
**contournables en appelant le contrat en direct**. Toute communication qui les présente comme
une propriété du vault serait fausse. Si elles doivent être opposables, elles doivent monter
dans le contrat.

### 7.6. Lire `process.env.NEXT_PUBLIC_*` **littéralement** (piège Turbopack)

Next/Turbopack n'inline une `NEXT_PUBLIC_*` dans le bundle **client** que si l'expression est
le littéral `process.env.NEXT_PUBLIC_FOO`. La lire à travers une variable (`env.NEXT_PUBLIC_FOO`)
n'est **pas** substitué statiquement → le navigateur reçoit `undefined` → adresse `null` →
« Configuration pending » silencieux, pour toujours. **Le piège a déjà été rencontré dans ce
repo** : `src/lib/onchain/vault.ts:66-73`.

C'est pourquoi, dans `dynavault.ts`, les **constantes de module** lisent l'env littéralement,
tandis que `resolveDynavaultAddress(env)` / `resolveVaultTarget(env)` restent des fonctions
pures à env injectée, **pour les tests unitaires uniquement**. Ne les refactorez pas l'une dans
l'autre.

### 7.7. Ne testez jamais `tx.to === VAULT_ADDRESS`

Établi en direct sur la seule tx de dépôt réelle du repo : son `to` de premier niveau est un
EntryPoint ERC-4337 (smart wallet Privy) — le dépôt vit dans la UserOperation. Toute
vérification serveur doit **décoder les logs**, jamais comparer `tx.to`. Ce test casserait sur
tous les wallets AA.

---

## 8. Où aller ensuite

- **État des lieux complet, lot par lot** (hygiène, whitelist KYC, indexation, data layer,
  proof) : [`docs/CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md`](CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md).
  Lire au minimum son §0 : **34 des 60 verdicts « ça marche » testés ont été rétrogradés**.
- **L'adaptateur et son contrat** : `src/lib/chain/dynavault.ts` (en-tête du fichier).
- **Les primitives bleues** : `src/components/ui/wired-chip.tsx`, `src/components/ui/wired-value.tsx`.
- **Les variables** : [`.env.example`](../.env.example), section *DYNAVAULT v2.1*.
