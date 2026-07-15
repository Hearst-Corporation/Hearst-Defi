# Cartographie Hearst Connect + plan de remplacement du smart contract

**Date** : 2026-07-15 · **HEAD** : `f6f9a5a5` · **Prod** : `connect.hearst.app` (Vercel)
**Cible du remplacement** : `HearstYieldVault` (ERC-4626, Base Sepolia) → `PermissionedDynaVault` v2.1

---

## 0. Comment ce document a été produit, et ce qu'il vaut

**Méthode** : 9 agents d'inventaire en parallèle (un par couche : parcours user, admin cœur,
admin analytique, endpoints/jobs, data layer, chain, engine/agents, chasse aux mocks,
doc-vs-code), puis une passe de **vérification adverse** où chaque verdict « LIVE » et chaque
item couplé à la chaîne est confié à un agent indépendant chargé de le **réfuter**, puis une
synthèse. 70 agents, 399 items, 1 369 appels d'outils.

**Ce que la passe adverse a changé** : **34 des 60 verdicts testés ont été rétrogradés (57 %)**.
Plus d'un « ça marche » sur deux était une surestimation. C'est la raison d'être de la méthode.

**Limite honnête n°1** : 214 verdicts LIVE/chain méritaient d'être réfutés, **60 seulement**
l'ont été (plafond de la passe). Les ~154 restants portent le verdict de l'agent d'inventaire,
non contre-vérifié. Vu le taux de rétrogradation mesuré, **il faut lire les « LIVE » non
vérifiés avec méfiance**, pas comme un acquis.

**Limite honnête n°2** : les agents lisent le **code**. Ils ne peuvent pas interroger la chaîne
ni la base. Les faits on-chain et SQL de ce document ont été établis séparément, en direct
(RPC Base Sepolia + SQL Supabase prod) — et ils ont servi à corriger le rapport (voir §0.2).

---

## 0.1. Faits établis en direct — chaîne et base de prod

Ces chiffres ne viennent pas de la lecture du code. Ils viennent d'un appel RPC sur Base
Sepolia et d'un `SELECT` sur la base de prod, le 2026-07-15.

**Le contrat, interrogé en direct** (`0x2bd14d52518a04f4c12949c51df03a161a9e329e`) :

| Appel | Valeur réelle |
|---|---|
| `name()` / `symbol()` | `Hearst Yield Vault Share` / `hyvUSDC` |
| `asset()` | `0x036CbD…dCF7e` = USDC Base Sepolia ✓ |
| `totalAssets()` | **12 USDC** |
| `totalSupply()` | 12e18 shares |
| `convertToAssets(1e18)` | **1.0000 USDC** — le vault n'a jamais accru un centime |
| `paused()` | `false` |
| `owner()` | `0x1d1d8744…1707` |
| `guardian()` | `0x5530db3B…AA57` |
| **`minDeposit()`** | **1 USDC** (`1000000`) |

**La base de prod, interrogée en direct** :

| Table | Lignes | Fait |
|---|---|---|
| `Position` | **7** (toutes actives) | **\$4 744 021** revendiqués |
| dont adossées à une tx | **1** | le \$11 de `adriennejkovic@gmail.com` |
| dont sans `txHashOpen` | **6** | dont un seed `dev@hearst.local` à **\$2 000 000** |
| `Distribution` / `DistributionLedgerEntry` / `Pcap` | **0 / 0 / 0** | aucune distribution n'a jamais été exécutée |
| `ShareClass` / `Subscription` | **0 / 0** | branche entière morte |
| `Proof` | **0** | le Proof Center n'a aucune preuve |
| `Investor` | 12 | **7 « approved », tous internes** ; 5 « pending » |
| `KycInquiry` | **1** | aucun LP externe n'a jamais été onboardé |
| `MiningMetric` | 424 | dernière : **2026-07-07** (crons morts depuis 8 jours) |

**L'écart, en une ligne** : la base revendique **\$4,74M**, la chaîne contient **12 USDC**.

**Vérification de la seule tx réelle** (`0xe65c4945…`) : elle **est** un vrai dépôt. Elle émet
`Deposit(assets = 11 USDC)` depuis le vault. Son `to` de premier niveau est un EntryPoint
ERC-4337 (`0xdb9b1e94…`, smart wallet Privy) — le dépôt vit dans la UserOperation.
→ **Conséquence de conception** : toute vérification serveur devra **décoder les logs**,
jamais tester `tx.to === VAULT_ADDRESS`. Ce test casserait sur tous les wallets AA.

---

## 0.2. Corrections apportées au rapport des agents

Le rapport ci-dessous (§1 à §9) est celui produit par les agents. J'y ai relevé deux erreurs
factuelles, corrigées ici plutôt que dans le corps du texte pour garder sa traçabilité :

**Correction 1 — `minDeposit`.** Le §6 affirme que « le contrat impose `minDeposit = 250000000000` »
et en déduit que le chemin on-chain serait inexécutable au faucet. **Faux** : la chaîne dit
**1 USDC**. Quelqu'un a appelé `setMinDeposit(1e6)`. L'agent a lu les `constructorArgs` du
registre committé au lieu d'interroger le contrat — soit exactement le piège qu'il dénonce
lui-même (`computeStaleness` ne lit jamais la chaîne). **Sa conclusion tient néanmoins** : le
dépôt de \$11 a bien eu lieu, mais pas via le formulaire (qui exige 250k côté client), donc le
CTA d'investissement n'a effectivement jamais produit de résultat en production.

**Correction 2 — dérive du registre.** Ce qui précède est un fait de première importance à
part entière : **`config/deployments.base-sepolia.json` ment**. Il déclare `minDepositUsdc: 250000`,
la chaîne dit 1. Et `computeStaleness()` (`src/lib/chain/deployments.ts:53-67`) ne teste que ce
JSON, jamais la chaîne — il est donc **structurellement incapable** de détecter la dérive, et
il affiche `stale = false` / `provenanceVerified = true` en la présence même de la dérive.

**Vérification que les agents n'ont pas pu faire** : le §11 demandait de confirmer que
`HEARST_PUBLISHER_PRIVATE_KEY` est bien présente en prod. **Elle l'est** (vérifié via l'API
Vercel, 75 clés en `production`). `NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS` y vaut bien
`0x2bd14d52518a04f4c12949c51df03a161a9e329e`, identique au registre committé. Les publishers
EventLogger et PoRRegistry sont donc **armés** en production.

---

## Partie A — État réel au 2026-07-15 (rapport des agents)

## 1. Verdict en 10 lignes

1. **Le produit est un registre Postgres qui affiche des chiffres, adossé à un contrat testnet qu'il n'interroge presque jamais.** Le seul écrit on-chain côté user est `deposit()` sur Base Sepolia (`src/lib/onchain/vault.ts:375-398`) ; tout le reste — valeur de position, NAV, AUM, distributions — vient de Prisma.
2. **Un seul dépôt on-chain réel existe en production : $11** (`Position.txHashOpen = 0xe65c4945…`, compte `adriennejkovic@gmail.com`). Les 6 autres positions (~$2,74M affichés) ont `txHashOpen = NULL` : seed/démo.
3. **`subscribe()` ne vérifie jamais la chaîne.** `src/app/actions/subscribe.ts:132` valide un regex `/^0x[0-9a-fA-F]{64}$/` et rien d'autre — pas de receipt, pas d'adresse cible, pas de montant. C'est une Server Action = RPC public.
4. **Il n'existe aucun chemin de sortie.** `redeemFromVault` est supprimée (diff non commité, −91 lignes) ; `src/app/actions/redeem.ts` n'a aucun appelant hors test ; aucune UI de retrait. Capital entrant on-chain, capital sortant : néant.
5. **Les distributions ne bougent aucun USDC.** `src/lib/distribution/atomic-exec.ts:132` : `` const txHash = `0xMOCK_${distributionId}` `` — hash fabriqué, écrit en base, ledger + PCAP + emails « Distribution processed » derrière.
6. **La gouvernance est du théâtre assumé.** `src/lib/governance/actions.ts:331` : *« Marks an EXECUTABLE proposal as EXECUTED (mock — no on-chain call) »*. Le calldata n'est jamais lu. Le « multisig » est une table Postgres avec des `userId`.
7. **« Mettre live » ne déploie rien.** `src/app/admin/vaults/actions.ts:543-551` tamponne une adresse env (fallback hardcodé `0x2bd14d52…`) sur n'importe quel vault, pour passer le filtre `isPlaceholderVault()`.
8. **Toute la flotte de crons est morte depuis le 2026-07-07** (8 jours). Dernière `MiningMetric` : 07-07 11:00. Et quand elle tournait, elle écrivait `uptimePct: 98.5` et `deployedHashrate: 182_000` en dur (`market-data-hourly.ts:117-118`).
9. **La vérité des données** : Telegram machines (40 768 lignes, frais du jour), sessions/auth, chat/LLM, document-vault. Tout le reste de la chaîne financière (ShareClass, Subscription, Distribution, Proof, GovernanceProposal) = **0 ligne en prod**.
10. **Le couplage app↔contrat est étroit — ~12 fichiers.** C'est la bonne nouvelle : le remplacement est chirurgical. La mauvaise : rien ne dépend du contrat, donc rien ne cassera si vous le remplacez mal. La désynchronisation sera silencieuse.

---

## 2. Actions côté USER

| Action | Écran | Server action / endpoint | Effet réel | Statut | Impact remplacement |
|---|---|---|---|---|---|
| Login email+password | `/`, `/login` | `login()` — `src/lib/auth/actions.ts:98` | Session Prisma + cookie `hc_session` | **LIVE** | none |
| Challenge TOTP | `/totp-challenge` | `verifyTotpChallenge()` — `actions.ts:206` | Session après code | **PARTIAL** | none |
| Candidature | `/apply` | `submitApplication()` — `src/app/apply/actions.ts:100` | User + QualificationProfile + HubSpot | **PARTIAL** | none |
| Reset mot de passe | `/forgot-password`, `/reset-password` | `requestPasswordReset()` — `password-reset.ts:108` | Token + email Resend | **PARTIAL** | none |
| Attester accréditation | `/onboarding/accreditation` | `attestAccreditation()` — `src/app/actions/accreditation.ts:34` | `Investor.accreditationAttestedAt` | **LIVE** | none |
| Soumettre KYC | `/onboarding/identity` | `submitKycDocument()` — `src/lib/onboarding/actions.ts:254` | Applicant Sumsub **sandbox** | **PARTIAL** | none |
| Recevoir verdict KYC | (webhook) | `POST /api/sumsub/webhook:63` | `Investor.kycStatus` | **PARTIAL** | none |
| Lier wallet | `/onboarding/wallet` | `bindWallet()` — `actions.ts:131` | `Investor.walletAddress` | **LIVE** | low |
| Voir les vaults | `/vaults` | `listVaults()` — `src/lib/data/vaults.ts:152` | Lecture ; 1 vault sur 5 visible | **PARTIAL** | **high** |
| Voir term sheet | `/vaults/[id]` | `getVault()` — `vaults.ts:181` | Lecture ; AUM = `demo_seed` $12.5M | **PARTIAL** | **high** |
| **Approuver USDC** | `/vaults/[id]/invest` | `approveUsdc()` — `src/lib/onchain/vault.ts:327` | **Vraie tx** Base Sepolia | **PARTIAL** | **high** |
| **Déposer** | `/vaults/[id]/invest` | `depositToVault()` — `vault.ts:375` | **Vraie tx** `deposit(assets,receiver)` | **PARTIAL** | **high** |
| Enregistrer position | (post-tx) | `subscribe()` — `src/app/actions/subscribe.ts:65` | Position + InvestorTransaction | **PARTIAL** | **high** |
| Voir confirmation | `/vaults/[id]/invest/confirmed` | `readNavPerShare()` — `vault.ts:457` | **Lecture chain** `convertToAssets` | **PARTIAL** | **high** |
| **Retirer** | — | `redeem()` — `src/app/actions/redeem.ts:30` | **Aucun** (zéro appelant) | **DEAD** | **high** |
| Voir portfolio | `/portfolio` | `loadPortfolioCockpit()` — `portfolio-cockpit.ts:411` | Lecture ; financier réel + fixtures pilote | **PARTIAL** | low |
| Voir une position | `/portfolio/[positionId]` | `loadPosition()` — `portfolio.ts:670` | Lecture ; 5 blocs hardcodés | **PARTIAL** | low |
| Voir mes vaults | `/my-vaults` | `loadPortfolio()` — `portfolio.ts:279` | Lecture ; « +0.0% » permanent | **PARTIAL** | low |
| Voir distributions | `/portfolio/distributions` | `loadPortfolio()` | Lecture, plafonnée à 5 lignes | **PARTIAL** | none |
| Voir yield | `/portfolio/yield` | `loadAllocationDonutProps()` — `portfolio.ts:576` | Ring alimenté par seed sinusoïdal | **PARTIAL** | none |
| Voir activité | `/portfolio/activity` | `loadPortfolio()` | Route non liée | **DEAD** | none |
| Voir fiscal | `/portfolio/tax` | `getTaxPreview()` — `tax.ts` | Route non liée, valeurs en dur | **DEAD** | none |
| Positions (alias) | `/portfolio/positions` | `redirect("/my-vaults")` | Redirect | **DEAD** | none |
| Sandbox V4 | `/portfolio/preview` | — | Mock intégral, hors rail | **MOCK** | none |
| Voir preuves | `/proof-center` | `loadProofCenterHubData()` — `hub-data.ts:46` | `fetchOnChainEvents` → `[]` systématique | **MOCK** | medium |
| Log de preuves | `/proof-center/full` | `loadProofCenterFullLog()` | 3 sections vides + audit en dur | **PARTIAL** | medium |
| Profil / sign-out | `/profile` | `logout()` — `actions.ts:192` | Session révoquée | **LIVE** | none |
| Télécharger relevé | (lien profil) | `GET /api/statements/[id]/pdf:662` | PDF, owner-check strict | **LIVE** | none |
| Chatter | (rail droit) | `POST /api/cockpit-chat:1070` | Réponse LLM + persistance | **LIVE** | none |
| **Seed démo** | `/portfolio` (démo) | `demoSeedPosition()` — `demo-actions.ts:150` | Position $250k **sans dépôt** | **MOCK** | none |
| **Simuler dépôt** | `/vaults/[id]/invest` (démo) | `simulateDeposit()` — `src/lib/demo/actions.ts:145` | Position **sans chain** | **MOCK** | none |
| **Simuler KYC** | `/onboarding/identity` (démo) | `simulateKycApproval()` — `demo/actions.ts:110` | `kycStatus='approved'` | **MOCK** | none |

### Le flux d'investissement, ligne par ligne

Voici **exactement** ce qui se passe quand un user clique « investir » aujourd'hui.

**Étape 0 — accès à l'écran.** `src/app/(product)/layout.tsx:30` applique `requireInvestor()` : gate fail-closed sur toutes les pages `(product)`. Puis `src/app/(product)/vaults/[id]/invest/page.tsx:32` : `notFound()` si `vault.status !== 'live'`. `:40-42` redirect vers `/onboarding/accreditation` si `!accreditationAttestedAt`. `:43-48` `resolveKycWalletGate` → redirect `/onboarding/identity` si KYC non approuvé.

> **Première réalité** : `getVault()` (`src/lib/data/vaults.ts:181-215`) ne renvoie une ligne que si `contractAddress` est non-vide (`isPlaceholderVault`, `:143-150`). En prod, **une seule ligne sur cinq** passe : `hearst-yield-vault`, `status='deployed'` → normalisé `'live'` (`vaults.ts:44-56`), `contractAddress = 0x2bd14d52518a04f4c12949c51df03a161a9e329e`. Les 4 autres (`defensive`, `btc-plus`, 2× "Single run") ont `contractAddress = NULL` → 404.

**Étape 1 — pre-flight.** `src/components/vaults/preflight-check.tsx:124` : `privyWallet.switchChain(84532)`. `:153` : `approveUsdc({ walletClient, amountUsdc })` → `src/lib/onchain/vault.ts:340-345` `writeContract('approve', [VAULT_ADDRESS, amount])`. **Vraie transaction USDC testnet.**

> Deux failles ici. `preflight-check.tsx:174-179` : `epochIndicative = { status: "ACTIVE" }` **hardcodé** — commentaire honnête : *« There is no real on-chain epoch deadline feed yet »*. Et `invest-form.tsx:522` : `allowanceApproved` est un `useState` local flippé par le bouton (`:701`), **jamais confronté à `ERC20.allowance()`** alors que l'ABI l'expose (`vault.ts:106-114`). État optimiste client.

**Étape 2 — le dépôt.** `src/components/vaults/invest-form.tsx:598-665` :
- `:605-610` refus si pas de wallet Privy ; `:613-617` refus si `VAULT_ADDRESS` null.
- `:619` `checkSubscribeEligibility(vault.id)` → re-vérifie accréditation + `kycStatus === 'approved'` + `vault.status === 'live'` côté serveur, **avant** la tx (`subscribe.ts:42-59`).
- `:631-639` `walletClientFromProvider(provider Privy)` → `depositToVault({ walletClient, amountUsdc, receiver: wallet })`.
- `src/lib/onchain/vault.ts:386` `assertBaseSepolia` → throw si `chainId !== 84532`. `:390-395` `writeContract('deposit', [assets, receiver])` + `waitForTransactionReceipt` (`:244`).

**→ Ici, et uniquement ici, de la vraie valeur bouge on-chain.** USDC testnet transféré, shares ERC-4626 émises au receiver.

**Étape 3 — l'enregistrement.** `:640-646` `subscribe(vault.id, amount, classCode, result.txHash)`.

`src/app/actions/subscribe.ts` — **aucun import viem dans ce fichier** :
- `:77-84` gates accréditation + KYC.
- `:125-129` `allowOffChain` honoré **uniquement** si `session.role === 'admin' || isDemoAccount(email)` — un investisseur qui POSTerait `{allowOffChain:true}` en RPC est silencieusement rétrogradé. Bon garde-fou.
- **`:132` `if (txHashClean && !/^0x[0-9a-fA-F]{64}$/.test(txHashClean))` — SEULE validation du txHash.**
- `:144-152` idempotence via `findUnique({ txHashOpen })`.
- `:166-176` `$transaction` → `createPositionInTransaction` (`subscribe-logic.ts:103`) : `Position(principalUsdc, status='active', txHashOpen, vaultKey)` + `InvestorTransaction(type='deposit')`.
- `:182-205` `Subscription` best-effort — **jamais atteint** (voir §5).

**Étape 4 — la confirmation.** `:655-657` redirect `/vaults/[id]/invest/confirmed?tx=..&amount=..&positionId=..`.
`confirmed/page.tsx:60-62` : `if (VAULT_CONTRACT && !isVaultStale())` → `readNavPerShare()` → `convertToAssets(1e18)`. **Vraie lecture chain**, la seule du parcours. `:82-87` re-vérifie `positionId` contre l'investisseur de la session (le param d'URL est explicitement traité comme non fiable, `:76-77`).

### Les trois trous du flux

**Trou 1 — le txHash n'est jamais vérifié.** Grep exhaustif : le seul `waitForTransactionReceipt` du repo est `vault.ts:244`, appelé depuis `invest-form.tsx` qui est `"use client"`. **Aucun `getTransactionReceipt` serveur nulle part.** Or `subscribe` est une Server Action = surface RPC publique. Un investisseur KYC-approuvé peut appeler `subscribe(vaultId, 250000, 'A', '0x' + 64 hex arbitraires)` et fabriquer une Position au montant de son choix (borné par `MAX_SUBSCRIBE_USDC = 1e9`, la capacité et le min-ticket). L'unicité `txHashOpen` empêche le rejeu du même hash, pas l'usage d'un hash étranger. **Le montant lui-même n'est jamais rapproché de la tx** : `subscribe-logic.ts:108` écrit `principalUsdc: amountUsdc` (paramètre client). On peut déposer $11 et enregistrer $250k.

**Trou 2 — aucune réconciliation.** `invest-form.tsx:647-653` : si la tx passe mais que `subscribe()` échoue, l'UI affiche *« deposit confirmed on-chain … but we could not record it, contact IR »*. Aucun retry, aucun job de rattrapage. L'argent est dans le vault, la Position n'existe pas.

**Trou 3 — pas de sortie.** `src/app/actions/redeem.ts` est complet et soigné (TOCTOU géré `:92-106`, ownership `:52-54`) mais `rg 'actions/redeem' src/` → un seul hit : son propre test. Son doc-comment `:11-12` affirme que le burn passe par `redeemFromVault (src/lib/onchain/vault.ts)` — **cette fonction n'existe pas** ; `git diff --stat` sur ce fichier montre `1 file changed, 91 deletions(-)` **non commitées** (suppression de `readMaxRedeem`, `previewRedeemUsdc`, `redeemFromVault`). L'ABI garde `redeem`/`maxRedeem`/`previewRedeem` (`vault.ts:158-183`), plus aucun code TS ne les appelle. Le libellé « Withdrawal » de `recent-activity.tsx` ne peut jamais s'afficher : le seul producteur de `type: "withdraw"` est `redeem.ts:111`.

### La valeur affichée à l'investisseur

`src/lib/portfolio/investor-nav-snapshot.ts:29-41` :
```
prisma.position.findMany({ where: { investorId, status: { in: ["active","matured"] } },
                           select: { principalUsdc, accruedYieldUsdc } })
  .reduce((sum, p) => sum + toNumber(p.principalUsdc) + toNumber(p.accruedYieldUsdc), 0)
```
**Zéro lecture chain.** Pas de `convertToAssets`, pas de `balanceOf`, pas de `totalAssets`. `readTotalAssets` existe (`vault.ts:438`) et **n'est ni exportée ni appelée**.

Et `accruedYieldUsdc` **n'a aucun écrivain de production** : les seuls writes sont `scripts/demo/yield-tick.ts:360`, `scripts/demo/timeline.ts:711`, `scripts/seed-dev-position.ts:85`, `src/lib/demo/timeline-core.ts:313` (gaté `isDemoAccount`). Aucun cron, aucune Server Action, aucun job.

**Conséquence pour une position réelle** : `valueUsdc = principal + 0`. « Current Value » duplique « Deposited », et le chip de performance (`my-vaults/page.tsx:96`) affiche un **« +0.0% » permanent en vert succès**.

Le PDF envoyé à l'investisseur ment sur ce point : `src/app/api/statements/[id]/pdf/route.tsx:316-317` affirme *« Accrued yield : DB Position.accruedYieldUsdc, refreshed by a cron from snapshots »*. **Ce cron n'existe pas.**

---

## 3. Actions côté ADMIN

Le gate est solide : `src/app/admin/layout.tsx:38-45` (`getSession()` → redirect si absent, `notFound()` si `role !== 'admin'`) **et** chaque Server Action re-vérifie `requireAdmin()` (`require-admin.ts:20-33`). Vérifié un par un sur ~35 actions : **aucun trou**.

### Vaults & déploiement

| Action | Écran | Server action | Effet réel | Statut | Impact |
|---|---|---|---|---|---|
| Créer draft | `/admin/vaults/new` | `createDraftVault` — `actions.ts:71` | VaultDeployment + ShareClass + audit | **LIVE** | none |
| Éditer draft | `/admin/vaults/[id]/edit` | `updateDraftVault` — `:146` | `$transaction` update + upsert | **LIVE** | none |
| Autosave wizard | `/admin/vaults/new` | `saveWizardStep` — `draft-actions.ts:24` | VaultDraft upsert | **LIVE** | none |
| Soumettre en review | `/admin/vaults/[id]` | `submitForReview` — `:246` | `status='review'` | **LIVE** | none |
| **Signer approbation** | `/admin/vaults/[id]` | `signApproval` — `:282` | Row DB ; `actorWallet = walletAddress ?? userId` | **PARTIAL** | medium |
| Réconcilier quorum | `/admin/vaults/[id]` | `reconcileDeployment` — `:374` | `status='deployed'` si quorum réel | **LIVE** | none |
| Hard-reject | `/admin/vaults/[id]` | `rejectDeployment` — `:431` | Purge votes + retour draft | **PARTIAL** | none |
| **Mettre live** | `/admin/vaults/[id]` | `markAsLive` — `:490` | **Tamponne une adresse env, ne déploie rien** | **PARTIAL** | **high** |
| Pause / Resume | `/admin/vaults/[id]` | `pauseVault` `:576` / `resumeVault` `:612` | **Statut DB seulement** | **PARTIAL** | **high** |
| Fermer | `/admin/vaults/[id]` | `closeVault` — `:648` | Étiquette terminale DB | **PARTIAL** | medium |
| Portfolio de vaults | `/admin/vaults` | `prisma.vaultDeployment.findMany:75` | Lecture ; 3 rows, toutes `createdBy='seed-vaults-prod'` | **PARTIAL** | none |

**Ce qui se passe vraiment quand un admin « déploie » un vault : rien on-chain.**

Le cycle complet (`draft → review → deployed → live → paused → closed`, machine `ALLOWED_TRANSITIONS` `actions.ts:49-56`) est 100% Postgres. Aucun `viem`, aucun `writeContract`, aucun `deployContract` dans tout `src/app/admin/vaults/`.

- **« deployed »** = `signApproval:334-353` compte les approvers distincts dans `VaultDeploymentApproval` et flippe le statut. Le « multisig » est une table : `:290` `actorWallet = admin.walletAddress ?? admin.userId` — pour un admin sans Investor, c'est un **userId**. Aucune signature cryptographique. `src/lib/governance/eip712.ts` existe, est testé, et n'est **importé nulle part hors tests** → DEAD.
- **« live »** = `markAsLive`. Le gate blueprint est réel et sérieux (`evaluateDeploymentLiveGate`, `blueprint.ts:336-367` : termes complets, disclaimers, allocation = 10000 bps, quorum). Puis `:543-545` :
  ```js
  const defaultContractAddress = process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS
                                 || "0x2bd14d52518a04f4c12949c51df03a161a9e329e";
  ```
  `:551` `contractAddress: vault.contractAddress || defaultContractAddress`. Le commentaire `:540-542` avoue : *« Set contractAddress so isPlaceholderVault() passes and the vault shows on the investor-facing /vaults page »*. **Tous les vaults marqués live pointent la MÊME adresse**, sans test d'identité — ce qui casse ADR-006 §2 (« No vault may reuse another's numbers silently »).
- **Le wizard annonce une étape `sign_deploy` « Sign & Deploy »** (`new/page.tsx:19`). `wizard.tsx` fait 66 lignes et ne contient **aucune** logique de déploiement.
- **Pause = étiquette.** Un vault `paused` en DB reste pleinement actif on-chain. L'UI est honnête (`[id]/page.tsx:253-256` : *« Existing investor records remain unchanged »*).

### Investisseurs & KYC

| Action | Écran | Server action | Effet réel | Statut | Impact |
|---|---|---|---|---|---|
| Registre | `/admin/customers` | `loadCustomers` | Lecture Prisma | **LIVE** | none |
| Fiche client | `/admin/customers/[id]` | `loadCustomerDetail` | Lecture | **LIVE** | none |
| Override KYC | `/admin/customers/[id]` | `setInvestorKyc` — `actions.ts:38` | `$transaction` + audit diff | **LIVE** | none |
| Créer investisseur | `/admin/customers` | `createInvestor` — `:106` | User + Investor, pwd inutilisable | **LIVE** | none |
| **Déployer position** | `/admin/customers/[id]` | `deployPosition` — `:199` | **Position off-chain, `txHash: null`** | **PARTIAL** | **high** |
| Lien d'activation | `/admin/customers/[id]` | `generateActivationLink` — `[id]/actions.ts:143` | Token 7j (n'envoie pas d'email) | **LIVE** | none |
| Qualification | `/admin/customers/[id]` | `saveQualification` — `:65` | Upsert + recalibration | **LIVE** | none |
| Onboarding test | `/admin/onboarding-test` | (formulaire) | **Crée un VRAI compte investisseur** | **LIVE** | none |

`deployPosition` mérite une ligne : `:265` `const VAULT_ID = 'hearst-yield-vault'` **en dur** (l'admin ne choisit pas), `:282-283` `capacityUsdc = deployment?.capacityUsdc?.toNumber() ?? 1_000_000_000` (plafond bidon si la ligne manque), `:293` `txHash: null`. Ces positions alimentent ensuite le calcul des distributions.

Malgré son nom, **`/admin/onboarding-test` est l'outil le plus écrivant de la console** — son sous-titre est explicite (`page.tsx:39`) : *« Not a dry run — submitting creates a real investor account »*.

### Distributions

| Action | Écran | Server action | Effet réel | Statut | Impact |
|---|---|---|---|---|---|
| Calculer split | `/admin/distributions` | `computeDistribution` — `actions.ts:75` | Dry-run ; **`vaultRef` ignoré** | **PARTIAL** | medium |
| Confirmer (2 sig.) | `/admin/distributions` | `confirmDistribution` — `:145` | Distribution + N InvestorTransaction | **PARTIAL** | medium |
| **Exécuter** | (interne) | `executeDistributionAtomically` — `atomic-exec.ts:67` | **`0xMOCK_` + ledger + PCAP mort** | **MOCK** | **high** |
| Rejouer finisher | `/admin/distributions` | `retryDistributionFinisher` — `:380` | Rejoue le mock | **PARTIAL** | medium |

**Aucun USDC ne bouge. Preuve nette :**
```js
// src/lib/distribution/atomic-exec.ts:132
const txHash = `0xMOCK_${distributionId}`;
```
Écrit tel quel en base (`:145-155`, CAS anti-double-exécution correct). Imports du fichier (`:1-7`) : prisma, inngest, logger, events. **Zéro viem.** `:232` retourne même `tx: { hash: txHash, status: "pending" }` — un statut « pending » pour une tx qui n'existera jamais.

**Ce qui est réel** : le multisig 2-signataires DB (`REQUIRED_SIGNERS = 2`, `:65`) avec montant verrouillé par le premier signataire (`:209-216`), identité dérivée serveur (`:164`, anti-forge), garde TOCTOU (`:354-365`), les `DistributionLedgerEntry`, les `InvestorTransaction`, et **les emails Resend « Distribution processed »**.

**Ce qui est mort** : le PCAP — `:167` `pcap.create({ pdfUrl: '/pcap/{id}/distribution-{period}.pdf' })` → `find src/app -ipath '*pcap*'` = **vide**. Lien mort servi comme artefact de conformité.

**Bug transverse à corriger avant tout paiement réel** : `computeDistribution:97-100` et `atomic-exec.ts:93-100` chargent `position.findMany({ where: { status: 'active' } })` — **sans filtre `vaultRef`**, alors que `vaultRef` est requis par le schéma (`:34`), loggé (`:130-136`) et écrit sur la Distribution (`:260`). En multi-vault, le split pro-rata porte sur toutes les positions de la plateforme.

**À l'honneur** : l'UI ne ment pas. `distributions/page.tsx:172-194` détecte `txHash.startsWith('0xMOCK')` → affiche « simulated » + ProvenanceBadge `estimated` au lieu d'`attested`.

### Gouvernance & allowlist

| Action | Écran | Server action | Effet réel | Statut | Impact |
|---|---|---|---|---|---|
| File de propositions | `/admin/governance` | `loadProposalQueue` — `governance/actions.ts:414` | Lecture ; **0 ligne en prod** | **PARTIAL** | none |
| Proposer | `/admin/governance/propose` | `proposeAction` — `:132` | Row ; **`targetAddress: ZERO_ADDRESS`** | **PARTIAL** | medium |
| Signer | `/admin/governance/proposal/[id]` | `signProposal` — `:199` | Row ; `signerAddress = admin.userId` | **PARTIAL** | medium |
| **Exécuter** | `/admin/governance/proposal/[id]` | `executeProposal` — `:334` | **`update({state:'EXECUTED'})`** | **MOCK** | **high** |
| CRUD allowlist | `/admin/governance/allowlist` | `addAllowlistEntry` — `allowlist.ts:98` | Row Prisma **fonctionnellement inerte** | **PARTIAL** | medium |

Le code l'admet lui-même :
- `governance/actions.ts:331` : *« Marks an EXECUTABLE proposal as EXECUTED (mock — no on-chain call). »* `:387-390` = un `update`. Le `calldata` n'est **jamais lu ni exécuté**, pour les 8 actionTypes — y compris `deploy`, `emergencyShutdown`, `updateFees`, `rotateSigners`.
- `:268` : `// Auto-advance QUEUED → TIMELOCK immediately (mock, no on-chain)`.
- `proposal/[id]/page.tsx:210` titre le champ *« Encoded transaction payload to be executed on-chain »*… et `:333-335` se rétracte : *« Actions are recorded on-chain mock only — no Solidity calls at this stage. »* Le champ est un `<textarea>` JSON libre (`propose/page.tsx:120-126`, placeholder `{"newFeeBps": 250}`) — pas de l'ABI-encoded.

**Routing court-circuité** : `proposeAction:122` définit `ZERO_ADDRESS` et `:150-153` appelle `routeForTransaction({ targetAddress: ZERO_ADDRESS, actionType })` sans `estimatedAmountUsdc`. Sur les 4 règles de `routing.ts:5-9`, la règle 2 (allowlisté → 2/3) et la règle 3 (<100k → 3/5) **ne peuvent jamais se déclencher**. Tout retombe sur 4/5+24h.

Conséquence directe : l'allowlist est **fonctionnellement morte**. `findAllowlistEntryByAddress` cherche toujours `0x000…0` → toujours null. Or `allowlist-board.tsx:81-89` affiche à l'écran : *« Addresses on this list use the fast path (2/3 sigs · 0h timelock) »*. **L'UI promet un effet que le runtime ne produit pas.** Table à 0 ligne en prod.

### Proofs

| Action | Écran | Server action | Effet réel | Statut | Impact |
|---|---|---|---|---|---|
| Bibliothèque | `/admin/proofs` | `prisma.proof.findMany:16` | Lecture ; **0 ligne** → empty state permanent | **PARTIAL** | none |
| Ingérer une preuve | — | `ingestProof` — `actions.ts:87` | `$transaction` proof + audit | **DEAD** | none |
| **Publier on-chain** | `/admin/proofs` | `publishProofOnChain` — `:169` | **Vraie tx `PoRRegistry.publish()`** | **PARTIAL** | medium |
| Supprimer | `/admin/proofs` | `deleteProof` — `:266` | Hard-delete + snapshot audit | **PARTIAL** | low |

`publishProofOnChain` est le **seul vrai write on-chain déclenché par un admin** : `:226` → `publish.ts:42-53` → `por-registry.ts:195-208` `walletClient.writeContract({ functionName: 'publish' })`. Comportement dés-armé honnête : `{ok:true, armed:false, txHash:null}` sans muter la DB.

Mais : `ingestProof` n'a **aucun appelant** (grep exhaustif = son propre test) → aucune UI d'ingestion. Le seul autre writer est `prisma/seed.ts:589-605`, dont les `mining_attestation` sont signées par la **clé de test Anvil** (`attestation/mock.ts:4`), partenaire inventé « Cathedra Mining (Texas) » (`:10`), AUM oscillant en `sin()` autour de 42,5 M$ (`:15,30-33`), CID IPFS fabriqué (`:36-38`). Le seed est honnête (`postedBy: "… · mock signer"`). **Ancrer ces proofs écrirait des chiffres fictifs on-chain.**

Piège : `por-registry.ts:211-217` catch → `return null`, et `actions.ts:228-231` interprète tout `null` comme *« publisher disarmed (no-op) »*. **Un échec réel de tx est rapporté à l'admin comme « désarmé ».**

### Stratégie & projections

| Surface | Écran | Effet | Statut | Impact |
|---|---|---|---|---|
| Strategy Hub | `/admin/strategies` | `strategy_configs` = **0 row** → fallback `PRODUCT_STRATEGIES` | **MOCK** | none |
| Strategy Workspace | `/admin/strategies/[slug]` | Fixtures + prix BTC live | **PARTIAL** | low |
| Sauver stratégie | — | `saveStrategyWorkspace` — `actions.ts:154` | 4 tables + audit ; jamais utilisée en prod | **LIVE** | none |
| Publier / archiver | `/admin/strategies` | `publishStrategy` — `:330` | **P2025 en prod** (ids fixtures) | **LIVE** | none |
| Projection Studio | `/admin/projection` | Loaders réels + badges honnêtes | **LIVE** | low |
| Lancer étude | `/admin/projection` | `runProjectionStudy` — `:114` | ScenarioRun ; **31 études en prod** | **LIVE** | none |
| Promouvoir en draft | `/admin/projection` | `promoteStudyToDraft` — `:328` | VaultDeployment ; `PROMOTE_DEFAULTS` en dur | **PARTIAL** | medium |
| Scenario Lab | `/admin/scenario-lab` | `VOL_INDEX_ASSUMPTION = 45` (`:40`), fallback `4.5` (`:53`) | **PARTIAL** | low |
| Backtest | `/admin/scenario-lab` | `backtest.ts:23` SPECS = **interpolation entre 2 points en dur** | **MOCK** | none |
| Product Workspace | `/admin/product-workspace` | Telegram 40k rows + marché ; **163 runs, dont aujourd'hui** | **LIVE** | low |
| Fiche produit BTC | `/admin/products/btc-mining-performance-vault` | Constante `BTC_MINING_PERFORMANCE_VAULT` | **MOCK** | none |
| Investor Memo | `/admin/investor-memo` | Agent GPT-4.1 sur vault **fixture** | **PARTIAL** | medium |
| Signals | `/admin/signals` | `RebalanceEvent` = 3 rows (seed, max 2026-05-04) | **PARTIAL** | low |
| **Exécuter signal** | `/admin/signals` | `writeRebalanceEvent` → **EventLogger** | **PARTIAL** | **high** |

`/admin/strategies` est le plus trompeur de la couche : toutes les apparences d'un outil DB-backed (Prisma, save, publish), mais `queries.ts:270` interroge `strategyConfig.findMany()` dans un try/catch qui **avale toute erreur** (`:277`), puis `:285-296` `if (mapped.length === 0) return PRODUCT_STRATEGIES.map(...)`. Table à 0 row en prod ⇒ **100% de fixtures**, en permanence. Et `publishStrategy` fait `update({where:{id}})` sur des ids qui n'existent pas en base → P2025 si un admin clique.

`/admin/product-workspace` mérite une note : le calcul est **réel** (Telegram + CoinGecko + mempool + DefiLlama + Monte-Carlo seedé) mais `construction-stepper.tsx:58` `MIN_STEP_MS = 5_000` impose un délai cosmétique par étape *« so narration + search read as real »*. **Théâtre de latence par-dessus un calcul honnête.**

### Écrans vitrine vs outils opérationnels

**Vitrine / galerie** (à ne pas confondre avec de l'outillage) :
- `/admin/chart-gallery` — **DEAD**. Zéro référence dans tout le repo (ni nav, ni lien, ni redirect). S'auto-déclare *« Demo data only »* (`page.tsx:11-13`).
- `/admin/design-system` — galerie assumée, vivante, liée en nav, canon déclaré du DS.
- `/admin/agentic` — **DEAD**, placeholder honnête : *« no fake agents, no invented metrics, no mock runs »* (`page.tsx:1-7`). Toujours en nav.
- `/admin/system/architecture` — **MOCK dangereux** : `data.ts:18` = 138 lignes de littéraux, `:24-26` badges `status: "Live"` **écrits à la main**. Une page qui affirme l'état du système sans jamais le sonder, sans mécanisme de resync.
- `/admin/products/btc-mining-performance-vault` — constante ; atténué par un bandeau *« configured, not validated »* (`:77-90`).
- `/admin/projection/preview` — **toujours** en mode « Demo Fixture » (`ProjectionStudyRun` = 0 en prod), honnêtement labellisé en nav.

**Opérationnels réels** : `/admin/marketplace` (la page la plus honnête : 4 fetchs externes, zéro chiffre en dur, provenance calculée partout), `/admin/source`, `/admin/monitoring` (seul avec de la donnée vivante : LlmRun 503, AdminToolRun 1291), `/admin/product-workspace`, `/admin/diagnostics`, `/admin/spec`, `/admin/outreach`, `/admin/audit`, `/admin/security` (2FA TOTP réellement appliquée au login), `/admin/onboarding-test`.

---

## 4. Endpoints & jobs

### Les 36 routes API

| Route | Auth | Validation | Effet | Statut |
|---|---|---|---|---|
| `GET /api/health` | publique (sonde) | — | `{status:"ok"}` | LIVE |
| `GET /api/health/deep` | **publique** | — | Ping DB + Redis, 503 si KO | **LIVE** ⚠️ |
| `GET /api/auth/dev-login` | double verrou dev | — | Session admin sans mdp | **DEAD** (404 en prod) |
| `POST/GET /api/auth/logout` | session | — | POST détruit, GET redirige (anti-CSRF) | LIVE |
| `GET/POST /api/admin/chat-tools` | `requireAdmin:243` | Zod union | Tools read + write HITL 2-temps ; **1291 runs** | LIVE |
| `GET /api/admin/diagnostics` | `requireAdmin:26` | — | Dry-run toutes suites | LIVE |
| `GET/POST /api/admin/diagnostics/chat-action-lab` | `requireAdmin:26` | — | Pur, sans LLM | LIVE |
| `POST /api/admin/diagnostics/chat-router` | `requireAdmin:20` | — | Suite routeur | LIVE |
| `POST /api/admin/diagnostics/guards` | `requireAdmin:21` | — | Suite guards | LIVE |
| `POST /api/admin/diagnostics/outreach` | `requireAdmin:22` | — | Guards + 1 probe read-only | LIVE |
| `POST /api/admin/diagnostics/persistence` | `requireAdmin:22` | — | Écriture DB **rollbackée** | LIVE |
| `POST /api/admin/diagnostics/projection` | `requireAdmin:20` | — | DB-writes **SKIPPED** | PARTIAL |
| `POST /api/admin/diagnostics/vault-hitl` | `requireAdmin:22` | — | Introspection registry | LIVE |
| `POST /api/admin/product-construction/stream` | `requireAdmin:33` | 400 si vide, rate 6/60s | NDJSON ; **163 runs, dernier aujourd'hui** | LIVE |
| `GET/POST /api/admin/review-document` | `requireAdmin` injecté | — | ReviewDocument (3 rows) | LIVE |
| `GET/POST /api/admin/review-mode` | `requireAdminUser:39,74` | type-guard | AdminChatMode (5 rows) | LIVE |
| `POST /api/agent-canvas/[canvasId]` | `getSession:44` + 404 admin | sanitize | Composition canvas | LIVE |
| `GET /api/chat-nav` | `requireAuth:19` | — | Read-and-clear scopé | LIVE |
| `POST /api/cockpit-chat` | `requireAuth:1094` | Zod ; **strip `system` client** | Chat streamé ; **217 runs** | LIVE |
| `GET/DELETE /api/cockpit-chats` | `requireAuth:38,66` | — | Scopé userId | LIVE |
| `GET/DELETE /api/cockpit-chats/[id]` | `requireAuth:27,86` | — | 404 si pas owner | LIVE |
| `GET/OPTIONS /api/document-vault/assets` | `requireAuth:25` | — | 15 rows (seed) | LIVE |
| `GET/POST /api/document-vault/documents` | `requireAuth:43,85` | Zod | **69 rows** ; ownerId forcé | LIVE |
| `GET/PATCH/DELETE /api/document-vault/documents/[id]` | `requireAuth` | Zod | Scopé ownerId, 404 jamais 403 | LIVE |
| `POST /api/document-vault/agent/plan` | `requireAuth:65` | Zod | Déterministe, annoncé comme tel | LIVE |
| `POST /api/document-vault/agent/create` | `requireAuth:50` | Zod | Document `source:"agent"` | LIVE |
| `POST /api/docusign/webhook` | **HMAC** fail-closed 503 | 413 >10MB | SubscriptionEnvelope ; **0 row** | PARTIAL |
| `POST /api/hubspot/webhook` | **HMAC** + anti-replay 5min | allowlist colonnes | QualificationProfile ; **secret = `""`** | PARTIAL |
| `GET/POST/PUT /api/inngest` | signature Inngest | — | 12 fonctions ; **muettes depuis 07-07** | PARTIAL |
| `POST /api/outreach/inbound` | **Svix** fail-closed | — | OutreachReply ; **0 row** | PARTIAL |
| `GET /api/outreach/unsubscribe` | **token HMAC** (pas de session) | token signé | Suppression ; **0 row** | PARTIAL |
| `POST /api/resend/webhook` | **Svix** fail-closed | progression monotone | OutreachEmailEvent ; **0 row** | PARTIAL |
| `GET /api/search` | `requireAdmin:26` | q ≤200 char | Index Prisma | LIVE |
| `GET /api/statements/[id]/pdf` | `requireAuth:669` + **owner-check:704** | rate 5/60s | PDF | LIVE |
| `POST /api/sumsub/webhook` | **HMAC** + claim serveur (P0-4) | Zod | KycEvent ; **2 rows = tests** | PARTIAL |
| `POST /api/typeform/webhook` | **HMAC** fail-closed 503 | — | QualificationProfile ; **0 row typeform** | PARTIAL |

### Routes mutantes sans gate d'auth — P0

**Aucune.** Vérification route par route :
- Toutes les routes admin appellent `requireAdmin()` en **première instruction**.
- Toutes les routes user : `requireAuth()` + owner-check applicatif — `statements/[id]/pdf:704` (`investor.userId !== userId → 404`), `document-vault` (`updateMany`/`deleteMany` scopés `{id, ownerId}`), `cockpit-chats` (scopé `{id, userId}`).
- Les 6 webhooks n'ont pas de session mais une signature HMAC/Svix **fail-closed** — le gate correct pour du machine-to-machine.

**Deux points à connaître, non exploitables :**
1. `GET /api/health/deep` est publique et **non marquée `// PUBLIC:`** alors que la convention CLAUDE.md l'exige. Expose l'état db/redis à un anonyme (lecture seule).
2. `GET /api/outreach/unsubscribe` est une **mutation en GET sans session** — volontaire et correctement justifié (`route.ts:21-24`) : l'autorisation est un token HMAC par adresse, les clients mail ne suivent que des GET, l'action est idempotente.

Le proxy edge (`src/proxy.ts:46`) laisse passer tout `/api` sans gate : assumé, documenté, l'auth est per-route. **`/api/auth/dev-login` est inatteignable en prod** : double verrou `NODE_ENV !== 'production'` **ET** `DEV_AUTH_BYPASS === '1'` (`dev-bypass.ts:16-19`) — le premier est décisif, Next force `NODE_ENV=production` au build, non configurable depuis Vercel.

### Webhooks — aucun n'est câblé côté fournisseur

| Webhook | Secret | Trafic réel | Preuve |
|---|---|---|---|
| Sumsub | présent (local) | **0** | Les 2 KycEvent sont des tests manuels (`test-applicant-…`, `never-claimed-xyz`, 2026-06-22) |
| Typeform | **absent** | **0** | Les 7 QualificationProfile ont **toutes** `source="self"` (le code écrit `source:"typeform"`) |
| DocuSign | **absent** | **0** | SubscriptionEnvelope = 0 |
| Resend | **absent** | **0** | Les 23 OutreachEmail sont toutes `draft`, `resendEmailId` NULL → aucune cible de corrélation |
| Outreach inbound | **absent** | **0** | OutreachReply = 0, OutreachSuppression = 0 |
| HubSpot | **`""`** (chaîne vide) | **0** | Falsy → 503 systématique ; les 6 HubSpotSync viennent du write direct |

Le code est **correct et bien durci** (HMAC constant-time, garde de taille, fail-closed, anti-replay 5 min HubSpot, protection anti-spoof d'`externalUserId` Sumsub) mais **non câblé côté fournisseur**.

### Les 12 jobs Inngest — flotte morte depuis 8 jours

Enregistrement : `src/app/api/inngest/route.ts:76-89`, auth fail-closed (throw au boot si `INNGEST_SIGNING_KEY` absent, `:64-72`).

**Fait majeur : arrêt simultané le 2026-07-07.** Dernières traces convergentes : MiningMetric 07-07 11:00, custody-snapshot-hourly 07-07 10:05, risk-explanation 07-07 09:30, mining-health 07-07 08:00. Cause au niveau app/clé Inngest (les commits de revert datent du 07-13, postérieurs).

| Job | Trigger | Effet réel prouvé | Statut |
|---|---|---|---|
| `market-data-hourly` | cron `0 * * * *` | **424 MiningMetric** ; 2 placeholders en dur ; doublons de retry | **PARTIAL** |
| `mining-health-daily` | cron `0 8 * * *` | **11 lignes agent** ; propage les placeholders | **PARTIAL** |
| `risk-daily` | cron `30 9 * * *` | **12 runs** ; lit un snapshot `demo_seed` | **PARTIAL** |
| `rebalancing-signal` | **event-driven** | **3 RebalanceEvent** | **PARTIAL** |
| `custody-snapshot-hourly` | cron `5 * * * *` | 18 runs, **0 écriture** (garde d'honnêteté, vault vide) | **PARTIAL** |
| `investor-nav-snapshot-hourly` | cron `10 * * * *` | **jamais exécuté** | **DEAD** |
| `investor-memo-monthly` | cron `0 9 1 * *` | **jamais exécuté** (ReportExport = 0) | **PARTIAL** |
| `distribution-executed` | event | **jamais déclenché** (Distribution = 0) | **MOCK** |
| `hubspot-reverse-sync` | cron `*/15` | pas de preuve d'exécution | **PARTIAL** |
| `outreach-send` | event | **0 envoi** (23 emails tous `draft`) | **MOCK** |
| `outreach-auto-send` | cron `0 * * * *` | inerte (`OUTREACH_AUTONOMY=SUGGEST`) | **MOCK** |
| `outreach-followups` | cron `0 9 * * *` | inerte | **MOCK** |

**Deux bugs qui faussent la lecture de « ce qui marche » :**

1. **Idempotence cassée sur `market-data-hourly`.** 0 ligne `LlmRun` agentName `market-data-hourly` alors que `markComplete` (`:145`) devrait en écrire une. Le seul step entre le persist (`:94`) et markComplete est `step.sendEvent` (`:136`) — et `INNGEST_EVENT_KEY` est absent. Le handler throw sur sendEvent → la garde ne s'arme jamais → **les retries re-persistent une MiningMetric à chaque tentative**. Signature mesurée : histogramme des minutes = `{0:284, 1:90, 2:37, 3:7, 4:3}`. Corollaire : l'event `market.data.updated` n'est jamais émis → le trigger correspondant de `rebalancing-signal` est mort.

2. **Fenêtre d'idempotence 24h sur des crons horaires.** `idempotency.ts:18` `IDEMPOTENCY_WINDOW_MS = 24h`, appliqué tel quel par `custody-snapshot-hourly` (`5 * * * *`) → **23 runs sur 24 skippés** (18 markers sur 17 jours = ~1/jour). Le message retourné dit `"already_run_this_hour"` alors que la fenêtre est journalière : **le code ment sur son propre comportement**.

`investor-nav-snapshot-hourly` n'a **jamais tourné** : aucun marker dans le GROUP BY complet de LlmRun (503 lignes, 11 agentName, somme vérifiée). Les 96 InvestorNavSnapshot sont un **backfill** — toutes à 09:00:00 pile, étalées du 2025-07-04 au 2026-07-03, incompatible avec un cron à la minute 10.

**Impact du remplacement du contrat sur cette couche : quasi nul.** Grep exhaustif `lib/chain|viem|writeHearstEvent|readContract` sur `src/app/api/**` + `src/lib/inngest/**` : **un seul fichier** — `distribution-executed.ts:10,164`. Et il vise l'**EventLogger** (`logEvent(kindIndex, contextHash, payloadCid)`), pas le vault : aucune dépendance à l'ABI du vault.

---

## 5. Data layer

### Le modèle central — et où il casse

**Chaîne théorique (doc)** : `User → Investor → Subscription → ShareClass → Position → Distribution`.

**Chaîne réelle (code, `src/app/actions/subscribe.ts`)** :
```
getInvestor()
  → gates (accreditation, kycStatus='approved', vault.status='live', minTicket, txHash)
  → prisma.vaultDeployment.findUnique({ id: vaultId })              :156
  → $transaction → createPositionInTransaction()                    :166-176
       = Position + InvestorTransaction(deposit)  ← LA VÉRITÉ
  → PUIS, best-effort :
       if (deployment) → shareClass.findUnique({vaultId_code})      :184
         → if (shareClassRow) → subscription.create                 :191
       ...dans un try/catch muet, commentaire :203 :
       « Non-fatal — Position is the source of truth »
```

**Cassure #1 — `ShareClass` = 0 row en prod.** Donc `shareClassRow` est toujours null ⇒ **`Subscription.create` n'est JAMAIS exécuté** ⇒ `Subscription` = 0 row malgré 7 Positions. Le commentaire du schéma (`:1003-1004`, *« A Position row is created downstream when the deposit settles on-chain »*) décrit **l'inverse exact** du code.

**Cassure #2 — `Distribution` = 0.** Le segment aval (Distribution → DistributionLedgerEntry → Pcap) n'a jamais tourné. Pourtant **`InvestorTransaction` contient 48 lignes `type='distribution'`** — issues des fixtures démo (`src/lib/demo/timeline-core.ts`), pas du moteur. **Le ledger investisseur raconte des distributions qui n'ont jamais eu lieu.**

**Cassure #3 — `VaultDeploymentApproval` = 0 et `GovernanceProposal` = 0.** Le vault en prod n'est jamais passé par son propre circuit d'approbation : il vient de `scripts/seed-vaults-prod.ts` (`createdBy='seed-vaults-prod'`).

**Cassure #4 — `accruedYieldUsdc` n'a aucun écrivain de production** (voir §2). La moitié de la NAV ne bouge jamais.

**État réel des 7 Positions** : une seule adossée à un dépôt on-chain (`0xe65c4945…`, **$11**). Les 6 autres, `txHashOpen = NULL` : $2 000 000 `dev@hearst.local` (id littéral `cmdevseed0000000000000000`), $996k + $250k + $250k `zand.demo@`, $250k + $998k `adrien+demo@`.

> **~$2,74M de principal affiché en production est fictif. Le réel est $11.**

### Les 70 modèles par domaine

| Domaine | Modèles | Rows prod | Statut |
|---|---|---|---|
| **Auth** | User (15), Session (1159), PasswordResetToken (20) | vivant | **LIVE** |
| **Investisseur** | Investor (12), KycInquiry (1), KycEvent (2 tests) | vivant | **LIVE / PARTIAL** |
| **Positions** | Position (7, dont **1 réelle**), InvestorTransaction (55, dont 48 fixtures) | pollué | **PARTIAL** |
| **NAV** | InvestorNavSnapshot (96 : dev_seed 53 / demo_fake 31 / demo_timeline 12 — **0 computed**) | 100% fixtures | **MOCK** |
| **Vaults** | VaultDeployment (5, 3 seed), VaultDeploymentApproval (0), **ShareClass (0)**, **Subscription (0)** | cassé | **PARTIAL / DEAD** |
| **Snapshots** | VaultSnapshot (**1 row, `demo_seed`, $12.5M**), Allocation (4, seed) | fabriqué | **MOCK** |
| **Distributions** | Distribution (0), DistributionApproval (0), DistributionLedgerEntry (0), **Pcap (0, write-only)** | jamais tourné | **PARTIAL** |
| **Proofs** | Proof (0), ReportExport (0) | vide | **PARTIAL** |
| **Gouvernance** | GovernanceProposal (0), ProposalSignature (0), AddressAllowlist (0) | vide | **PARTIAL** |
| **Mining** | MiningMetric (**424**, cron mort 07-07) | rance | **PARTIAL** |
| **Telegram** | TelegramMachineMarketSnapshot (637), **TelegramMachineMarketRow (40 768)** | **frais du jour** | **LIVE** |
| **Engine** | ScenarioRun (52), ProjectionStudyRun (31), BacktestRun (0), RebalanceEvent (3 seed) | mixte | **LIVE / PARTIAL** |
| **Chat/LLM** | CockpitChat (287), CockpitMessage (719), **LlmRun (503)**, **AdminToolRun (1291)**, AdminWriteToolConfirmation (13), AdminChatMode (5), ReviewDocument (3) | vivant | **LIVE** |
| **Agents** | UserAgentProfile (7), QualificationProfile (7), AgentMemory (0), **AgentTemplate (0)** | mixte | **LIVE / DEAD** |
| **Outreach** | Prospect (19), Campaign (6), Email (23 draft), ICP (1), EmailEvent (0), Reply (0), Suppression (0) | inerte | **PARTIAL** |
| **Document Vault** | DocumentVaultDocument (69), Asset (15 seed), Event (69) | vivant | **LIVE / MOCK** |
| **Strategy** | 7 tables `strategy_*` | **toutes à 0** | **MOCK / DEAD** |
| **Divers** | AdminAudit (60), HubSpotSync (6), VaultDraft (5), SavedView (0), Notification (0), NavTrace (26), AgenticRouterDecisionTrace (57), Feedback (0), RoadmapValidation (0), SubscriptionEnvelope (0), OnboardingProgress (0) | mixte | — |

> **Note méthode** : `pg_stat_user_tables.n_live_tup` est périmé sur cette base (annonçait AdminToolRun=10 vs 1291 réels). Tous les chiffres viennent de `count(*)` exacts.

### Modèles jamais écrits

**Zéro writer applicatif ET zéro script** :
- `OnboardingProgress` — zéro occurrence dans tout le repo.
- `StrategyProjectionRun` / `StrategyProjectionSnapshot` / `StrategyProjectionEvent` — zéro occurrence. Le Strategy Studio projette en mémoire sans persister.
- `AgenticRouterDecisionTrace` — writer **supprimé du repo** (`src/lib/agentic/observability/decision-summary.ts` n'existe ni dans l'arbre ni dans `git ls-tree HEAD`). 57 rows figées au 07-05. `ROUTER_TRACE_RETENTION_DAYS` déclarée `env.ts:336`, consommée nulle part.
- `Notification` — **aucun `create`/`createMany` nulle part.** Les 4 writers (`actions.ts:28/43/61/79`) sont des `updateMany` (mark-read/archive/snooze) sur un ensemble toujours vide.

**Writer seulement dans un script CLI** :
- `AgentTemplate` — `scripts/create-agent-template.ts:36` seul ⇒ `UserAgentProfile.templateId` toujours NULL.
- `DocumentVaultAsset` — `scripts/seed-document-vault-assets.ts:58` seul. Aucun upload runtime.

**Writer présent mais inatteignable** : `ShareClass`, `Subscription`, `VaultSnapshot` (garde jamais vraie).

> **Faux positifs levés** (ne pas supprimer) : `TelegramMachineMarketRow` (nested `rows: { create }`, `read-machines.ts:136`), `DocumentVaultEvent` (multiline `route.ts:134-135`), `NavTrace` (multiline `cockpit-chat/route.ts:703`), `ReviewDocument` (writer **hors repo**, `node_modules/@hearst/review-mode/dist/routes/review-document.js:244`, prisma injecté par `route.ts:15`), `Allocation` (nested).

### Modèles jamais lus (write-only)

- **`Pcap`** — écrit `atomic-exec.ts:168`, zéro reader. Ni index ni FK ; `distributionId` String nue.
- **`Subscription`** — écrit `subscribe.ts:191`, zéro reader.
- **`SubscriptionEnvelope`** — écrit par le webhook DocuSign, zéro reader. **Le PDF signé n'est jamais relu, et `subscribe()` ne vérifie jamais qu'il existe.**
- `OutreachEmailEvent` / `OutreachReply` — écrits par webhooks, zéro reader.
- `DocumentVaultEvent` — audit append-only assumé (69 rows).

### Doublons conceptuels

| Concept | Sources concurrentes | Qui gagne |
|---|---|---|
| **Position d'un investisseur** | `Position` · `Subscription` · `InvestorTransaction` | **Position**, assumé en dur (`subscribe.ts:203`). Subscription = mort-né, supprimable. |
| **AUM** | `VaultSnapshot.aumUsdc` (1 row demo_seed) · somme live des Position | `listVaults():161` prend le snapshot ; `subscribe():161-164` re-dérive depuis les Positions *« not the cached snapshot »*. **Les deux ne coïncident pas.** |
| **Adresse du contrat** | (a) env `NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS` · (b) `config/deployments.base-sepolia.json` · (c) `VaultDeployment.contractAddress` | **(a) seule transige** ; (b) affichage/staleness ; (c) filtre d'honnêteté. **Aucune assertion d'égalité.** |
| **Termes de share class** | `ShareClass` (DB, vide) · `src/lib/engine/share-class.ts` (canonique) · constructeur du contrat (`minDepositUsdc: 250000`) | **Aucune synchronisation.** |
| **Allocation cible** | `engine/vaults.ts:64-69` (60/25/10/5) · `pilot-fixtures.ts:130` (`POCKET_SPLIT` 40/37/23) | **Deux vérités coexistent**, aucune ne référence l'autre. |
| **Statut du vault** | `VaultDeployment.status='deployed'` | Normalisé `'live'` (`vaults.ts:44-56`) → l'admin affiche « 0 live », l'investisseur voit « Live ». |
| **Stratégies** | `strategy_*` (0 row) · `PRODUCT_STRATEGIES` | Fallback statique **systématique** (`queries.ts:286`). |
| **Roadmap** | `docs/roadmap.json` · `RoadmapValidation` (0 row) | Le JSON nu. |

### Dérive de schéma

**4 tables existent en prod sans `model` dans `prisma/schema.prisma`** : `Withdrawal`, `WithdrawalApproval`, `Institution`, `InstitutionMember` (toutes à 0 row). Origine : le commit `a0ff3252` (« feat: add withdrawal request form ») annulé par `f6f9a5a5` — le revert a retiré les models, les tables sont restées. Un `prisma migrate` futur pourrait proposer de les dropper.

`_prisma_migrations` contient **2 lignes avec `finished_at = NULL`** (`20260625120000_add_agentic_router_decision_trace`, `20260626120000_add_investor_nav_snapshot`) — doublons non terminés à côté de leurs jumelles réussies. À nettoyer avant toute nouvelle migration.

Les tables `strategy_*` et `document_vault_*` sont en base **sans migration correspondante** (`grep -rl "strategy_configs" prisma/migrations/` → NONE) : arrivées par `db push`. **L'historique de migration ne décrit plus la base.** Colonnes `strategy_*` en String/Int nu, sans `CHECK` miroir des enums — d'où le parsing défensif `queries.ts:35-131`.

### Sécurité DB — à arbitrer

**RLS est désactivé sur les 75 tables de `public` en prod**, y compris `User`, `Session`, `Investor`, `Position`, `InvestorTransaction`, `KycEvent`. Elles sont exposées aux rôles `anon`/`authenticated`. CLAUDE.md acte *« Postgres pur ⇒ RLS impossible ⇒ owner-check applicatif »* — sauf que la prod **est** Supabase, donc la clé anon contourne la couche applicative. Non bloquant tant que l'app n'utilise que Prisma via `DATABASE_URL` (c'est le cas, aucun client Supabase côté navigateur), mais `NEXT_PUBLIC_SUPABASE_URL` est publiée : l'exposition dépend entièrement de la non-diffusion de la clé anon. **Activer RLS sans policies couperait tous les accès** — décision à trancher, pas de remède appliqué.

---

## 6. Couche chain — LA ZONE DE REMPLACEMENT

### État réel : y a-t-il des transactions on-chain aujourd'hui ?

**OUI — trois chemins d'écriture réels, dont un seul déclenché par un utilisateur.**

**(a) USER / wallet Privy — le chemin vivant.**
`preflight-check.tsx:148-153` → `approveUsdc` → `vault.ts:340-345` `writeContract('approve')`.
`invest-form.tsx:630-638` → `depositToVault` → `vault.ts:390-395` `writeContract('deposit')` + `waitForTransactionReceipt` (`:244`).
Ni faux txHash, ni no-op : sans `VAULT_ADDRESS`, `ConfigError` est levée (`vault.ts:328-334`) et le CTA est bloqué (`invest-form.tsx:558`).

**(b) ADMIN / clé serveur** — `publishProofOnChain` (`admin/proofs/actions.ts:226`) → `PoRRegistry.publish`.

**(c) SYSTÈME / clé serveur** — `writeRebalanceEvent` (`admin/signals/actions.ts:185,327`, en `void` fire-and-forget) et `writeHearstEvent` (`inngest/distribution-executed.ts:164`) → `EventLogger.logEvent`.

> (b) et (c) sont **désarmables en silence** : sans `HEARST_PUBLISHER_PRIVATE_KEY`, les writers retournent `null` **sans jamais throw** (`publisher.ts:30`, `event-logger.ts:182`, `por-registry.ts:192`). En local la clé est présente → armé. En prod : non gaté par `env.ts`, donc invérifiable depuis le repo.

**CE QUI N'EXISTE PAS : aucune sortie on-chain.** `redeemFromVault` supprimée (diff non commité), `redeem()` sans appelant, aucune UI de retrait.

**Preuve de volume réel** : 1 seule Position avec txHash (`0xe65c4945…`, $11). Or `invest-form.tsx:535` exige `amount >= 250 000` et le contrat impose `minDeposit = 250000000000` — **zéro position ≥250k adossée à une tx**. Sur un testnet alimenté au faucet, réunir 250k USDC Sepolia rend ce chemin de facto inexécutable. **Le CTA on-chain de la page invest n'a produit aucun résultat en production.**

### Les 3 contrats existants

| | Adresse | Bloc | Rôle | Appelé par |
|---|---|---|---|---|
| **HearstYieldVault** | `0x2bd14d52518a04f4c12949c51df03a161a9e329e` | 42743997 | ERC-4626 sur USDC | `vault.ts` (deposit, convertToAssets) |
| **EventLogger** | `0x6A5483F6D6a5d43A3CAFE36d3001dd23e24EbD38` | 42743173 | Journal immuable | `chain/event-logger.ts`, signals, distribution-executed |
| **PoRRegistry** | `0xbB9e0350830670de45730706bE6710df665aA60D` | 42743173 | Attestations PoR | `chain/por-registry.ts`, publishProofOnChain |

Réseau **unique** : Base Sepolia, chainId 84532, importé en dur (`client.ts:4,26`, `vault.ts:33`, `publisher.ts:5`). **Aucun mainnet nulle part.** Receipts vérifiés dans `contracts/broadcast/**/run-latest.json`, tous `status=0x1`. Cohérence broadcast ≡ `config/deployments.base-sepolia.json` ≡ `.env.local`.

**`HearstYieldVault.sol` — interface réelle** (lu en entier, `contracts/src/HearstYieldVault.sol:35-170`) :
- `is ERC4626, Ownable, Pausable` (`:35`). deposit/mint/withdraw/redeem/totalAssets/convertToAssets/previewX/maxX **hérités OpenZeppelin, non modifiés**, sauf 2 overrides :
  - `_deposit` (`:149-157`) — `whenNotPaused` + `if (assets < minDeposit) revert DepositBelowMinimum`
  - `_withdraw` (`:162-169`) — `whenNotPaused` seul
- Ajouts : `minDeposit` (250k USDC, setter onlyOwner `:103`), `guardian` (pause/unpause only, `:124/130`, rotation onlyOwner `:113`), `_decimalsOffset()=12` (`:39`) → parts 18 déc / asset 6 déc, défense anti-inflation par virtual shares.
- **Aucune logique de yield, rebalancing, stratégie ou cross-chain on-chain** (`:12-16`). Pas de file d'attente de retrait, pas de rôle ORACLE_REPORTER, pas de module de frais, **pas de proxy — le contrat n'est PAS upgradeable**.

**Usage réel par l'app** :
- **UTILISÉ** : `deposit` (invest-form), `convertToAssets(1e18)` (page confirmed), `USDC.approve`.
- **DÉCLARÉ MAIS MORT** : `totalAssets` — `readTotalAssets` (`vault.ts:438`) n'est **ni exportée ni appelée** → l'AUM affiché ne vient pas de la chaîne (le seed le dit : *« It does NOT drive the dashboard AUM (that comes from VaultSnapshot.aumUsdc) »*).
- **JAMAIS UTILISÉ** : `redeem`/`maxRedeem`/`previewRedeem`, `previewDeposit`, `asset`, `balanceOf`, `pause`/`unpause`, `setMinDeposit`, `setGuardian`. **Aucune surface admin ne pilote le contrat** — pas de bouton pause, pas de setter.

**⚠️ Cumul de rôles** : `owner_` du vault (`ctorArgs[3]`) = `0x1d1d87443f7B76f7C2248956240dE735Bce81707` = `HEARST_PUBLISHER` = publisher d'EventLogger **et** de PoRRegistry. **Une seule EOA détient owner du vault + les 3 droits d'écriture.** Seul le guardian est distinct (`0x5530db3B10e3F872ffA89cD2e3C542e9351EAA57` — qui est aussi le wallet du compte démo `adrien+demo@`). Le TimelockController (`DeployGovernance.s.sol`) **n'a jamais été déployé** (aucun broadcast) : la posture « owner = multisig timelocké » décrite dans `HearstYieldVault.sol:26-34` est **fausse**.

### Surface de couplage app↔contrat — la liste de travail

**ABI en dur (aucune génération depuis `contracts/out`) :**
| Fichier | Contenu |
|---|---|
| `src/lib/onchain/vault.ts:95-200` | `ERC20_ABI` + `ERC4626_ABI` inline — **fichier n°1** |
| `src/lib/chain/abis.ts:1-138` | `EVENT_LOGGER_ABI`, `EVENT_LOGGER_WRITE_ABI`, `POR_REGISTRY_ABI`, `POR_REGISTRY_WRITE_ABI`, `EVENT_KIND_LABELS` (miroir manuel de l'enum Solidity) |

**Adresse / registre / réseau :**
| Fichier | Rôle |
|---|---|
| `config/deployments.base-sepolia.json` | Source des adresses (JSON committé) |
| `src/lib/chain/deployments.ts:1-109` | Zod + staleness + explorer |
| `src/lib/chain/client.ts:1-104` | PublicClient viem, chain baseSepolia figée, résolution EIP-55 |
| `src/lib/chain/explorer.ts` | URLs BaseScan + `isPlaceholderTxHash` |
| `src/lib/env.ts:43-50, 441-452` | Schéma Zod + **gate prod** (throw si adresse absente) |
| `src/lib/onchain/vault.ts:39,75-82` | `VAULT_ADDRESS`, `USDC_ADDRESS`, `BASE_SEPOLIA_CHAIN_ID` |
| **`src/app/admin/vaults/actions.ts:543-545`** | **⚠️ adresse `0x2bd14d52…` ÉCRITE EN DUR, hors registre** |

**Appels contrat :**
| Fichier | Opération |
|---|---|
| `src/lib/chain/event-logger.ts:59-234` | `getContractEvents` + `logEvent` |
| `src/lib/chain/por-registry.ts:60-218` | `getContractEvents` + `publish` |
| `src/lib/chain/publisher.ts:28-79` | Signer serveur unique |
| `src/lib/chain/get-logs-chunked.ts` | Pagination eth_getLogs |
| `src/lib/attestation/publish.ts:42-53` | Bridge attestation → `publish` |

**Surfaces qui présupposent le comportement du contrat :**
| Fichier | Dépendance |
|---|---|
| `src/components/vaults/invest-form.tsx:613-660` | `deposit(assets,receiver)` |
| `src/components/vaults/preflight-check.tsx:137-168` | `approve(vault,amount)` |
| `src/app/(product)/vaults/[id]/invest/confirmed/page.tsx:41-70` | `convertToAssets(1e18)`, shares 18 déc |
| `src/lib/proof-center/platform-addresses.ts:11-51` | Affiche l'adresse + libellé « ERC-4626 » en dur |
| `src/app/actions/subscribe.ts` | txHash opaque (format seul) |
| `src/app/actions/redeem.ts` | Référence `redeemFromVault` **inexistante** |
| `src/app/admin/proofs/actions.ts:169-256` | ABI `publish` |
| `src/app/admin/signals/actions.ts:185,327` | `writeRebalanceEvent` |
| `src/lib/inngest/functions/distribution-executed.ts:152-172` | `writeHearstEvent` |

**Contrats / scripts / tests / docs :**
`contracts/src/*.sol` (3), `contracts/script/*.sol` (3), `contracts/test/*.t.sol` (**73 tests** : Vault 32, PoR 16, Governance 13, EventLogger 12), `contracts/broadcast/**`, `contracts/foundry.toml`, `docs/audit/spearbit-prep-2026-05-26/abi-freeze.json`, `contracts/README.md`.

**NON couplés (ne bougent pas)** : `src/lib/onchain/index.ts` (affichage pur), `src/lib/data/custody.ts` (Fireblocks off-chain), tout `src/lib/engine/*`, tout le portfolio, les 36 routes API sauf une, 11 des 12 jobs.

### Pièges de la surface actuelle

1. **`computeStaleness` est taillée pour l'ancien contrat.** `deployments.ts:53-67` ne teste que `constructorArgs.length === 5` **OU** `minDepositUsdc < 250000`. Le registre actuel a 6 args et 250000 ⇒ `stale = false` **en permanence**. Un nouveau contrat avec 4 ou 7 args sera déclaré « frais » sans aucune vérification. `provenanceVerified` = conjonction de deux booléens **écrits à la main** dans le JSON (`broadcastCommitted && sourceMatchesCommitted`) — de la déclaration, pas de la vérification. Aucun script générateur/vérificateur n'existe.

2. **`FREE_TIER_BLOCK_WINDOW = 10n`** (`event-logger.ts:21`) — sans `NEXT_PUBLIC_EVENT_LOGGER_DEPLOY_BLOCK`, on ne lit que les 10 derniers blocs. **Pire** : `NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE` n'est définie **nulle part** → `get-logs-chunked.ts:21` `DEFAULT_CHUNK_SIZE = 100_000n`, alors que le RPC Alchemy free tier plafonne `eth_getLogs` à **10 blocs**. Vérifié empiriquement : la fenêtre exacte émise par le code renvoie `{"code":-32600,"message":"Under the Free tier plan... up to a 10 block range"}`. Retry → échec → `throw` → catch (`por-registry.ts:149-155`) → `[]`. **`fetchOnChainEvents` et `fetchOnChainAttestations` renvoient `[]` à CHAQUE appel**, pendant que l'UI affiche `chainConfigured = true`.

3. **Toutes les lectures chain catchent en `return []`** : une panne RPC est **indiscernable d'une absence d'events**.

4. **Toutes les écritures serveur échouent en silence** si la clé publisher manque, et `signals` les appelle en `void`.

### Ce qui est verrouillé par ADR

**ADR-006 (Accepted, 2026-05-22) — le verrou.** §3 : écrire des contrats mainnet-ready, des scripts et un runbook est **autorisé** ; *« The actual mainnet deployment remains gated on a completed Spearbit audit + remediation (`audit-final` roadmap item). Lifting #8 does not authorize pushing unaudited code to Base mainnet. Testnet deploys are free. »* Verrouille aussi : PRNG seed injecté, APY **range** obligatoire même en Monte-Carlo, vault id clé de première classe (*« No vault may reuse another's numbers silently »*), auto-exécution des rebalances **interdite**.

**Vérifié dans le code** : aucun script mainnet, aucun broadcast hors `84532`, `assertBaseSepolia` verrouille le wallet. Roadmap cohérente : `v1 | audit-final | todo`, `v1 | vault-mainnet | todo`, `mvp | audit-kickoff | validated`.

**ADR-009** — gouvernance cible : Safe 3/5 → TimelockController 48h (owner), Guardian Safe 2/3 séparé. **Non déployés.**

**ADR-018 (2026-06-24) — la ligne rouge chain :** *« Swarms prepare, simulate, verify, draft and monitor. Humans sign and authorize. Crews may read chain state, simulate, compare ABI/address/chainId, draft Safe payloads … but never hold a key, sign a transaction, or move funds. »*

**Architecture gelée** (SoT `contracts/src/*` @ `898991c`) : OZ v5.6.1 @ `5fd1781b`, solc 0.8.24, optimizer 200, EVM cancun, `via_ir=false`, forge **73/73**. CI : le job `foundry` est **advisory** (`ci.yml:212` `continue-on-error: true`).

> **⚠️ Le contrat n'est pas upgradeable.** « Remplacer le contrat » = **redéployer une nouvelle instance + migrer**, pas upgrader. Le nouveau contrat retombe intégralement sous le gate ADR-006 : **le pack Spearbit (freeze SHA `898991c`) devient caduc et repart de zéro.**

---

## 7. Ce qui est FAUX-LIVE

Le repo contient une infrastructure d'honnêteté **réelle et rigoureuse** (`timeline-snapshot.ts:30-45`, `freshness.ts`, `custody.ts:110`, `protocol-tvl.ts:159`, la suite `data-honesty-guards.test.ts`, le hard guard `custody-snapshot-hourly.ts:57-69`). Le problème n'est pas l'absence de garde-fous — c'est leur **application inégale**. Les mensonges restants sont presque tous au dernier mètre : un badge littéral posé au-dessus d'un pipeline par ailleurs honnête.

### Mock trompeur — badge Live/Attested sur donnée fabriquée

| # | Mensonge | Fichier:ligne | Gravité |
|---|---|---|---|
| **1** | **« Monthly USDC distributions »** — le txHash est une string mock, le PCAP un chemin mort, l'email « Distribution processed » part quand même | `atomic-exec.ts:132`, `:167` ; `invest-form.tsx:99` | **Critique** |
| **2** | **Badge « Live » en dur sur de la gouvernance explicitement mock** — le compte à rebours de timelock, sur la page « Proof » | `timelock-countdown.tsx:106` (`<ProvenanceBadge kind="live" />` littéral) au-dessus de `governance/actions.ts:268` *(mock, no on-chain)* | **Critique** |
| **3** | **« Vault live » en dur dans le footer, sur chaque page** — badge vert + texte, aucune condition | `app-footer.tsx:139-140` vs `custody-snapshot-hourly.ts:55-56` *« The vault is currently empty (0 USDC) »* | **Haute** |
| **4** | **5 badges « Attested » littéraux** — tooltip *« Data verified by third-party attestation »*, aucune attestation dans le chemin | `portfolio/[positionId]/page.tsx:368,520,576` · `portfolio/page.tsx:424` · `position-infrastructure-proofs.tsx:104` | **Haute** |
| **5** | **Hashrate et uptime du parc = constantes rafraîchies toutes les heures**, à côté de vraies données BTC | `market-data-hourly.ts:117-118` (`uptimePct: 98.5`, `deployedHashrate: 182_000`), propagé `mining-health-daily.ts:87` | **Haute** |
| **6** | **Le PDF investisseur badge son AUM « live »** — commentaire *« Custody snapshot at end of period — live »* sur un snapshot seed | `memo-pages/executive-summary.tsx:95` ; idem `btc-tactical.tsx:70,77` | **Haute** (document qui circule) |
| **7** | **Lien BaseScan mort présenté comme preuve** — seul consommateur non gardé sur cinq | `portfolio/[positionId]/page.tsx:127` (pas de `isPlaceholderTxHash`) ; aggravé par `zand-fixture.ts:64` (`0xZANDDEMOSEED0000…`, non-hex, **échappe même au garde-fou** `explorer.ts:22-24`) | **Moyenne** |
| **8** | **L'AUM de /vaults ignore la provenance** — un snapshot `demo_seed` de **$12.5M** s'affiche comme l'AUM public | `data/vaults.ts:166-170` (pas de `where: timelineSnapshotWhere()`, contrairement à `dashboard.ts:475`) | **Haute** |
| **9** | **La cloche de notifications est un décor** — `unreadCount={0}` en dur, tiroir figé, focus trap impeccable autour de zéro donnée | `notifications-bell-wrapper.tsx:19`, `:160` ; rendue `admin/layout.tsx:52` | **Basse** |
| **10** | **Deux vérités d'allocation contradictoires** | `pilot-fixtures.ts:130-137` (40/37/23, ×1.24) vs `engine/vaults.ts:64-69` (60/25/10/5) | **Moyenne** |
| **11** | **`/admin/system/architecture` affirme l'état du système sans le sonder** — 138 lignes de littéraux, badges « Live » écrits à la main, aucun resync | `data.ts:18`, `:24-26` | **Moyenne** |
| **12** | **L'allowlist promet un fast-path qui n'existe pas** | `allowlist-board.tsx:81-89` vs `governance/actions.ts:122,150-153` (ZERO_ADDRESS) | **Moyenne** |
| **13** | **Un échec de tx est rapporté comme « désarmé »** | `por-registry.ts:211-217` → `actions.ts:228-231` | **Moyenne** |
| **14** | **Le gate « Epoch » du pre-flight est une constante** | `preflight-check.tsx:174-179` (`epochIndicative = { status: "ACTIVE" }`) | **Basse** |
| **15** | **L'allowance n'est jamais lue on-chain** — `useState` optimiste | `invest-form.tsx:522` vs ABI `vault.ts:106-114` | **Basse** |
| **16** | **Théâtre de latence** — 5s cosmétiques par étape *« so narration + search read as real »*, par-dessus un calcul réel | `construction-stepper.tsx:58` | **Basse** |

### Mock assumé — état honnête

À porter au crédit du code, ces surfaces **disent ce qu'elles sont** :
- **`pilot-fixtures.ts:1-23`** — header sans ambiguïté (*« ILLUSTRATIVE PILOT / SAMPLE values… NEVER presented as the investor's real, attested numbers »*), badgé Estimated/Simulated, **module délibérément séparé** du mock sandbox pour satisfaire `portfolio-real-data-contract.test.ts`.
- **`portfolio-cockpit.ts:213-214`** — `{label:'Financial figures', value:'real / attested'}` vs `{label:'Operational feed', value:'pilot sample', provenance:'simulated'}`. Frontière explicite.
- **`/portfolio/preview`** — mock intégral, header *« NOTHING is live except hashprice »*, hors rail (`product-nav-items.ts`, `safe-redirect.ts`).
- **`memo-pages/mining-health.tsx:45-51`** — **la seule surface qui dit la vérité sur les placeholders** : *« both still hardcoded placeholders written by the hourly cron (RP-10)… Never badge them attested until a real fleet feed lands »* puis force `opsProvenance = "estimated"`. **Le modèle à généraliser.**
- **`source-truth-summary.ts`** — s'auto-dénonce : `:106` vol index = MOCK, `:103-104` risques SC/contrepartie = UNAUDITED, `:110` p5/p50/p95 = PARTIAL, `:46` verdict figé *« GO ADMIN ONLY »*. **La meilleure boussole du repo.**
- **`admin/distributions/page.tsx:172-194`** — détecte `0xMOCK` → « simulated » + badge `estimated`.
- **`custody-snapshot-hourly.ts:57-69`** — **refuse d'écrire** un faux AUM.
- **`vaults.ts:143-150`** — refuse d'exposer un vault sans contrat.
- **`/admin/agentic`** — placeholder honnête : *« no fake agents, no invented metrics »*.
- **`demo/actions.ts`, `zand-fixture.ts`** — verrouillés par allowlist serveur + downgrade défensif `subscribe.ts:127-129`.
- **`btc-mining-performance-vault`** — bandeau *« configured, not validated »*.

### Le motif, et sa correction

**Plus on descend vers la donnée, plus c'est honnête ; plus on monte vers le pixel, plus c'est déclaratif.** Les loaders calculent, les composants littéralisent.

Le non-négociable #2 (« every metric has a provenance badge ») est respecté à la lettre et trahi dans l'esprit : la **présence** du badge est vérifiable mécaniquement, sa **véracité** ne l'est pas. Le badge est devenu un ornement obligatoire.

**Correction mécanique, ~10 call-sites** : interdire `<ProvenanceBadge kind="live|attested" />` en littéral hors `design-system/` (règle ESLint ou `check-*.mjs` dans la gate) et forcer le passage par une valeur calculée.

---

## 8. Doc vs code

| # | Affirmation | Réalité | Danger |
|---|---|---|---|
| **1** | README:3 — *« monthly USDC distributions »* | `atomic-exec.ts:132` `0xMOCK_` | **Critique** — c'est la promesse produit centrale |
| **2** | ADR-010:34 — vault = `0xEc733c6d…`, minDeposit 1 000 USDC. **ADR non amendé** | `config/deployments.base-sepolia.json` : `0x2bd14d52…`, minDeposit 250 000, 6 args, guardian | **Critique** — c'est LE doc qu'on lit pour savoir quel contrat est déployé |
| **3** | PROGRAM_MASTER:70 + PROJECT_STATE:148 — *« Instance testnet PRÉDATE le guardian → à redéployer »* | **Déjà fait le 2026-06-22** | **Critique** |
| **4** | abi-freeze.json:414/:20/:147 — `TO_BE_REDEPLOYED` / `TO_BE_FILLED` ×3 | Les 3 contrats sont déployés, receipts `0x1` | **Critique** — le pack d'audit ment sur l'état actuel |
| **5** | `redeem.ts:11-12` — le burn passe par `redeemFromVault` | **La fonction n'existe pas** | **Haute** |
| **6** | `pdf/route.tsx:316-317` — *« accruedYieldUsdc, refreshed by a cron »* | **Ce cron n'existe pas** | **Haute** — document envoyé à l'investisseur |
| **7** | `UI_DATA_COVERAGE.md:27-40` — 7 loaders LP en statut LIVE | **7/7 n'existent pas.** Le vrai est `loadPortfolioCockpit` | **Haute** |
| **8** | `UI_DATA_COVERAGE.md:110-116` — toute la « MOCK/DEMO GUARD REFERENCE » | **0 hit sur tout le repo.** Le vrai est une allowlist email (`demo/allowlist.ts:14-17`) | **Haute** — impossible de savoir depuis la doc ce qui est vrai vs fixture |
| **9** | `SYSTEM_MAP.md:50` — `src/lib/demo/{builders,provider,guard}.ts` | Les 3 fichiers n'existent pas | Moyenne |
| **10** | `SYSTEM_MAP.md:39-41` — `PROTECTED_PREFIXES` + matcher à synchroniser | Le proxy est en **default-deny** (`PUBLIC_PREFIXES`, `proxy.ts:38-48`). **Le code est plus sûr que la doc** | Moyenne |
| **11** | README:45 — *« LP : seul outil `navigate` »* | `chat-agent.ts:20,370,430` : *« The model exposes NO navigate tool »* (ADR-018) | Moyenne |
| **12** | README:359 — *« ds:token-drift / ds:layout — BLOQUANT »* | **Ni l'un ni l'autre nulle part** ; la CI lance `ds:guard:all`, le pre-commit ne lance que `secrets-scan.sh`. Et `DO_NOT_TOUCH`/`VALIDATION_MATRIX` disent l'inverse. **Les 3 docs se contredisent, aucune n'a raison** | Moyenne |
| **13** | README:528 + `BACKEND_CONTEXT.md:12` — `PERSONA_WEBHOOK_SECRET`, `persona/webhook` | **Le provider est Sumsub.** Aucun `PERSONA_*` dans `env.ts`. Provisionner cette var en prod ne gate rien | Moyenne — la doc go-live envoie provisionner la mauvaise var |
| **14** | `BACKEND_CONTEXT.md:7,12` — 23 server actions, 18 API routes | **19** et **36** (exactement le double) | Basse |
| **15** | README:458+ — `pnpm seed:investor-demo` (**6 fois**) | N'existe pas (seul `:reset` existe) | Basse |
| **16** | `AGENTS.md:38` — `protected-docs-check.mjs` en pre-commit | Le script existe, **câblé nulle part** | Basse |
| **17** | README:11-16 vs `SYSTEM_MAP.md:88` + CLAUDE.md — **contradiction frontale sur la DB de dev** (Supabase prod vs SQLite) | Le code supporte les deux (`PRISMA_PROVIDER`), la CI tranche pour SQLite. **Et ADR-010:53 nomme `cnisndlptnuivupgxcmq` là où README:12 nomme `xrwzxhsenwmlxbwqcftz`** — deux refs Supabase | **Haute** — c'est la base où vit `contractAddress` |
| **18** | `SYSTEM_MAP.md:55-57` — 6 composants « non câblés = voulu » | ⌘K et NotificationsBell **sont rendus** (`admin/layout.tsx:51-52`) ; UI_DATA_COVERAGE se contredit elle-même | Basse |
| **19** | Mémoire — *« Migration document_vault bloquée »* | **Appliquée** : 69 documents créés le 2026-07-09 en prod | Moyenne |
| **20** | Mémoire — *« $500k dev_seed purgé »* | **Le montant est aujourd'hui $2M** (`cmdevseed0000000000000000`) | Moyenne |

**Ce que la doc dit VRAI et qui a été vérifié** : la pureté de l'engine (23/23 fichiers, seuls des commentaires matchent), la garde APY-range (`scenario.ts:24` `MIN_APY_SPREAD_BPS = 50`, exact), les bandes de coverage (`coverage.ts:34-36`, exactes), le lock mainnet, l'idempotence money-path, la migration ADR-017 (`/api/outreach-chat` bien retiré), `OUTREACH_AUTONOMY` défaut `SUGGEST`, le kill-switch chat sans fallback.

**Le plus grave** : quatre documents normatifs (dont l'**ADR** et le **pack d'audit Spearbit**) désignent un contrat mort. **Un fichier JSON de config est aujourd'hui la seule vérité sur ce qui est déployé.**

---

## 9. Code mort

### Chain / money-path
| Élément | Preuve |
|---|---|
| `src/app/actions/redeem.ts` | `rg 'actions/redeem' src/` → un seul hit : son test |
| `redeemFromVault` + `readMaxRedeem` + `previewRedeemUsdc` | **Supprimées, diff non commité** (−91 lignes) |
| `readTotalAssets` (`vault.ts:438`) | Ni exportée ni appelée |
| `src/lib/governance/eip712.ts` | Importé **uniquement** par son test. Brique prête si le nouveau contrat exige des signatures vérifiables |
| `contracts/script/DeployGovernance.s.sol` | Aucun broadcast → timelock jamais déployé |
| `ingestProof` (`admin/proofs/actions.ts:87`) | Aucun appelant hors test → aucune UI d'ingestion |
| `src/lib/attestation/mock.ts` | Consommé uniquement par `prisma/seed.ts:12` |

### Server actions / libs
| Élément | Preuve |
|---|---|
| `src/lib/views/actions.ts` (5 exports) | `rg 'createView\|loadUserViews\|SavedView'` hors le dossier → **zéro** |
| `src/lib/notifications/*` (moteur complet : matrice, canaux, templates) | `rg 'lib/notifications' src/ --glob '!src/lib/notifications/**'` → **uniquement le test** |
| `src/lib/portfolio/blended-apy.ts` | 0 consommateur (`blendedApyPct` de `economics-views.ts` est un homonyme sans rapport) |
| `src/lib/portfolio/tax-preview-loader.ts` | `loadTaxPreview` → 0 consommateur (`tax.ts` est vivant) |
| `src/lib/agents/outreach-writer-extended.ts` | `draftWhatsApp` — agent LLM complet, jamais invoqué |

### Routes / pages
| Route | Preuve |
|---|---|
| `/admin/chart-gallery` | `grep -rn "/admin/chart-gallery" src/` → **0 hit** |
| `/admin/agentic` | Placeholder honnête assumé |
| `/portfolio/activity` | Aucune entrée nav, `leafHref` jamais passée, `navigate-tool.ts:48-51` l'exclut |
| `/portfolio/tax` | Idem ; `UNWIRED_PORTFOLIO_LEAVES` dans les tests |
| `/portfolio/positions` | Redirect stub, `UNWIRED_PORTFOLIO_LEAVES` |
| `/api/auth/dev-login` | 404 en prod (double verrou) |
| `/api/admin/agents/graph` | **Supprimée dans l'arbre** (non commité) |

### Modèles / colonnes
`OnboardingProgress`, `StrategyProjectionRun/Snapshot/Event`, `AgenticRouterDecisionTrace` (writer supprimé), `Notification`, `AgentTemplate`, `Pcap` (write-only), `Subscription` (write-only inatteignable), `SubscriptionEnvelope` (write-only), `OutreachEmailEvent`/`OutreachReply` (write-only).

### Faux positifs — NE PAS supprimer
`engine/btc-tactical.ts` + `engine/ratios.ts` (importés par `scenario.ts:5,7`) · `proof-center/{attestation-truth,cold-empty,hub-counts,platform-addresses}.ts` (via `hub-data.ts:21-24`) · les 6 routes `hideFromSubNav:true` volontaires (scenario-lab, projection/preview, btc-mining-performance-vault, diagnostics, onboarding-test, agent-canvas) · `/admin/proof-center` (hors sub-nav mais ciblée par `revalidatePath`) · ⌘K et NotificationsBell (**rendus**, contrairement à la mémoire).

---

## 10. Confrontation avec la spec `PermissionedDynaVault` v2.1

La spec du nouveau contrat est arrivée après l'inventaire. Elle **répond à 10 des 16 questions
ouvertes** que les agents avaient identifiées. Voici ce qu'elle tranche, et ce qu'elle casse.

### 10.1. Ce que la spec tranche

| # | Question ouverte | Réponse de la spec | Conséquence |
|---|---|---|---|
| 1 | Custody — le contrat détient-il les fonds ? | **Oui.** `deposit` transfère l'asset au vault, qui alloue aux stratégies B1/B2 et garde B3 en idle | Fireblocks (compte 86, vide) n'est plus la custody du vault. **Le Proof Center doit cesser de le présenter comme tel** |
| 2 | Qui signe ? | **Deux rôles** : `owner` (config) + `keeper` (opérations). Aucun Safe, aucun Timelock | ADR-009 (Safe 3/5 + Timelock 48h) reste **non satisfait**. Le cumul owner/publisher sur une EOA unique persiste si on ne fait rien |
| 3 | Forme du contrat | **ERC-4626-*like*, PAS le standard** (voir §10.2) | L'ABI inline de `vault.ts` est à **réécrire en entier** |
| 4 | Upgradeable ? | **Probablement oui** — l'annexe liste un « **Vault Proxy** » | À confirmer : change la nature du chantier (remplacement unique vs récurrent) |
| 6 | Combien de contrats ? | **1 vault + 3 adapters** (USDT / LBTC / RWA) + keeper bot | Le multi-vault (Yield/Defensive/BTC Plus) n'est **pas** couvert. `markAsLive` qui tamponne la même adresse partout reste un bug à corriger |
| 7 | Le NAV vient d'où ? | **De la chaîne.** `totalAssets()` = somme des stratégies + idle | ✅ Débloque le trou n°1. `accruedYieldUsdc` (aucun writer) devient **inutile** : le NAV est dérivé de `convertToAssets()` |
| 8 | L'AUM vient d'où ? | **`totalAssets()`** | `VaultSnapshot.aumUsdc` (1 row `demo_seed` \$12.5M) devient un **cache**, plus une source |
| 9 | Distributions | **Aucune fonction de distribution.** Modèle = BTC livré à l'expiration + take-profit + vending curve | **Le produit change.** Voir §10.3 |
| 10 | Gate KYC | **On-chain** : `whitelist(address)`, `addToWhitelist`, `permissionDisabled` | Nouveau chemin de synchronisation à écrire. **Bloquant** : 10/12 investisseurs prod n'ont pas de `walletAddress` |
| 11 | Retraits | **`redeem(shares, receiver, owner)` + `redeemProportional(receiver)`.** Pas de file d'attente, **pas de lock-up on-chain** | Le soft-lock 60j devient **applicatif seulement**, donc contournable en appelant le contrat en direct |

### 10.2. Ce n'est pas un ERC-4626 — et ça change le coût

La spec présente des noms familiers, mais la surface **diverge du standard sur trois points
qui cassent le code actuel** :

| Standard ERC-4626 (contrat actuel) | Spec v2.1 | Impact |
|---|---|---|
| `totalSupply()` | **`totalShares()`** | fonction différente |
| `balanceOf(address)` | **`shares(address)`** | fonction différente |
| `Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)` | **`Deposit(address indexed user, uint256 assets, uint256 shares)`** | **signature différente ⇒ topic0 différent** |
| `Withdraw(sender, receiver, owner, assets, shares)` | **`Redeem(address indexed user, uint256 shares, uint256 assets)`** | **event renommé + réordonné** |
| `previewDeposit` / `maxRedeem` / `previewRedeem` | **absents de la liste des views** | l'ABI actuelle les déclare |

**Conséquence pratique** : `src/lib/onchain/vault.ts:95-200` (`ERC4626_ABI` inline) n'est pas
« à ajuster », il est **à jeter et réécrire**. Et tout indexeur futur devra viser la nouvelle
signature d'event — un indexeur écrit contre le standard ne verrait **rien**.

**La bonne nouvelle** : c'est précisément le fichier unique par lequel tout passe. La surface
de couplage app↔contrat est étroite — **~12 fichiers**, dont **2 seuls** portent des ABI
(`onchain/vault.ts`, `chain/abis.ts`). Le remplacement est **chirurgical**.

**La mauvaise** : aujourd'hui **presque rien ne dépend du contrat** (l'AUM vient de Prisma,
le NAV n'est lu que sur une page de confirmation, `readTotalAssets` est morte). Donc **rien ne
cassera bruyamment si on le remplace mal**. La désynchronisation sera silencieuse. C'est
l'argument central pour le check de cohérence au boot (Lot 1).

### 10.3. Le point dur : le produit change, pas seulement le contrat

La spec **n'a aucune fonction de distribution**. Le modèle devient : BTC accumulé, take-profit
par paliers, vending curve qui vide B3 vers zéro sur 24 mois, **BTC livré à l'expiration**.

La promesse « **monthly USDC distributions** » — qui est la première ligne du README, du
term sheet, des specs produit et de l'argumentaire outreach — **disparaît**.

Ce que ça périme :

| Surface | Sort |
|---|---|
| `Distribution`, `DistributionApproval`, `DistributionLedgerEntry`, `Pcap` | **0 ligne en prod** → suppression sans perte |
| `src/lib/distribution/atomic-exec.ts` (le `0xMOCK_`) | supprimé ou réécrit pour le nouveau modèle |
| `/admin/distributions` + `actions.ts` | supprimé ou repensé |
| `src/lib/inngest/functions/distribution-executed.ts` | supprimé |
| Panneau distributions du Proof Center, `/portfolio/distributions` | repensés |
| `src/lib/agents/outreach-writer-extended.ts` | **vend un produit qui n'existera plus** |
| README, `docs/spec/*`, `docs/methodology/v1.0.md` | à reprendre |

> **Ironie utile** : ces tables sont **déjà toutes vides en prod**. On ne détruit rien —
> **on arrête de promettre**. Le `0xMOCK_` n'a jamais trompé personne parce que personne
> n'a jamais reçu de distribution.

**Ce n'est pas une décision technique.** La méthodologie est déclarée immuable une fois
publiée (CLAUDE.md) → il faut un **ADR de remplacement** + un **bump méthodologie v2.0**
avant de coder, pas après.

### 10.4. Ce que la spec ne tranche pas — Lot 0 résiduel

Six points bloquent encore le cadrage. Trois sont pour l'ingénieur contrat, trois pour Adrien.

**Pour l'ingénieur contrat :**

1. **USDT ou USDC ?** La spec **se contredit**. §1 et §3 disent USDT (`asset()` → USDT).
   §7 s'intitule « **USDC** Reserve Pocket » et ses flux disent « swap BTC → **USDC** ».
   L'app est USDC de bout en bout : **2 248 occurrences dans 263 fichiers**, **21 colonnes
   Prisma `*Usdc`**, et le vault actuel pointe l'USDC Base Sepolia. Si c'est vraiment USDT,
   ce n'est pas un rename cosmétique — c'est le **retypage de tout le domaine métier**, plus
   une question de liquidité sur Base.
2. **`swapAndReport(..., bytes32[] swapData)`** — de la calldata de swap en `bytes32[]` est
   très probablement un `bytes` déguisé. À confirmer avant d'écrire le client.
3. **Proxy, oui ou non ?** L'annexe liste « Vault Proxy » mais la spec n'en parle jamais.
   Et **décimales des shares** : le contrat actuel a `_decimalsOffset()=12` (shares 18 /
   asset 6) et `ONE_SHARE=1e18` en dur (`vault.ts:428`). La spec dit « 1:1 initially »
   sans préciser.

**Pour Adrien :**

4. **Le min-ticket \$250k et le lock-up 60j sortent du contrat.** Le nouveau n'a que
   `tvlCap` + whitelist. Donc ces termes deviennent **applicatifs, donc contournables** :
   un whitelisté appelle `deposit`/`redeem` en direct et l'app ne voit rien. S'ils sont
   contractuels vis-à-vis des LP → les remettre on-chain. Sinon → assumer qu'ils sont
   juridiques et pas techniques, et le dire dans la doc.
5. **La falaise de liquidité du redeem est *par conception*.** `redeem` puise « idle first,
   then adapters » ; B1 est du hardware de mining (non liquidable à la demande) ; et la
   vending curve **vise délibérément** B3 → 0 à l'expiration. Donc plus on approche du terme,
   moins le redeem est honorable. **Ce n'est pas un bug, c'est le produit** — mais l'UI devra
   le représenter honnêtement, et aujourd'hui il n'y a **aucun** chemin de sortie à afficher.
6. **La position réelle de \$11** pointe l'ancien vault. Migrer, ou clore + redéposer ?

**Rappel de gate, non négociable** : ADR-006 verrouille le mainnet sur un audit Spearbit
**complété + remédié**. Le nouveau contrat **repart de zéro** sur ce gate — le pack d'audit
existant (freeze SHA `898991c`) devient **caduc**. Le contrat actuel n'étant pas upgradeable,
« remplacer » = **redéployer + migrer**, pas upgrader.

---

## 11. Plan de remplacement par lots

### Lot 0 — Décider (aucun code)

1. Trancher les 6 points du §10.4.
2. **ADR de remplacement** (ADR-019) : nouveau contrat, nouveau modèle produit, mort des
   distributions mensuelles. Les ADR sont append-only → marquer ADR-010 *Superseded*.
3. **Bump méthodologie v2.0** — la v1.0 décrit un produit à distribution mensuelle.
4. Décider du sort du diff **non commité** de `src/lib/onchain/vault.ts` (**−91 lignes**,
   suppression du chemin redeem). Toute décision sur la sortie se prend en connaissance de ce diff.

### Lot 1 — Hygiène préalable (indépendant du contrat, à faire maintenant)

Ces chantiers ne dépendent pas de la spec et **conditionnent la fiabilité de tout le reste**.

| Cible | Fichier | Travail |
|---|---|---|
| **Crons morts depuis 8 jours** | dashboard Inngest | **Diagnostiquer d'abord.** Cause probable : `INNGEST_EVENT_KEY` absente → `step.sendEvent` throw (`market-data-hourly.ts:136`) → `markComplete` (`:145`) jamais atteint |
| **Purger le seed prod** | `scripts/wipe-seeded-data.ts` | Le \$2M `dev@hearst.local` (`cmdevseed0000000000000000`) + le `VaultSnapshot` `demo_seed` \$12.5M qui alimente risk-daily |
| **Placeholders persistés comme mesures** | `market-data-hourly.ts:117-118` | `uptimePct: 98.5`, `deployedHashrate: 182_000` en dur |
| **Registre qui ment** | `chain/deployments.ts:53-67` | `computeStaleness` ne lit jamais la chaîne. **Le remplacer par une vérification réelle** (comparer registre ↔ RPC) |
| **RPC plafonné à 10 blocs** | `get-logs-chunked.ts:21` | `NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE` **n'existe nulle part** → défaut 100 000 vs plafond RPC 10. `fetchOnChainEvents` renvoie `[]` **à chaque appel** |
| **Badges Live/Attested littéraux** | ~10 call-sites | Règle ESLint / `check-*.mjs` : interdire `<ProvenanceBadge kind="live\|attested" />` en littéral hors `design-system/` |
| **RLS désactivé sur 75 tables prod** | Supabase | Exposées à `anon`/`authenticated`, et `NEXT_PUBLIC_SUPABASE_URL` est publique. ⚠️ **Activer RLS sans policies couperait tous les accès** — chantier à part, à ne pas improviser |
| **KYC en sandbox en prod** | `SUMSUB_APP_TOKEN` = `sbx:` | Les verdicts GREEN **ne sont pas opposables**. Bloquant pour un vrai LP |

### Lot 2 — Couche d'abstraction chain

**Objectif** : un point de passage unique, pour que le *prochain* remplacement soit un
changement de config.

- **Créer** `src/lib/chain/vault-adapter.ts` — interface unique. Toute l'app passe par là.
- **Réécrire** `src/lib/onchain/vault.ts` — ABI (`:95-200`), `USDC_ADDRESS` (`:81`),
  `BASE_SEPOLIA_CHAIN_ID` (`:33,39`), `assertBaseSepolia` (`:296-303`), `ONE_SHARE` (`:428`).
- **Purger** l'adresse en dur `0x2bd14d52…` de `src/app/admin/vaults/actions.ts:543-545`.
- **Check au boot** : `throw` si `resolveVaultAddress() !== getDeployment("vault").address`.
  **C'est le seul endroit où une divergence de contrat peut se propager silencieusement
  jusqu'à l'investisseur.**
- **Piège documenté, déjà rencontré** (`vault.ts:66-73`) : lire l'env indirectement casse
  l'inlining Turbopack → `VAULT_ADDRESS = null` → « Configuration pending » silencieux.
  Lire `process.env.X` **littéralement**.
- **Régénérer** `config/deployments.base-sepolia.json` + `contracts/script/DeployNewVault.s.sol`
  + tests Foundry (le repo est en **Foundry** ; la spec §8 décrit du Hardhat sur un autre repo).

**Ordre** : décisions §10.4 → contrat + tests → deploy testnet → registre → adapter → env → check.

### Lot 3 — Whitelist KYC on-chain (nouveau, n'existe pas)

C'est le lot **le plus neuf** : la spec déplace le gate KYC on-chain.

- **Bloquant amont** : **10/12 investisseurs prod n'ont pas de `walletAddress`**. Sans adresse,
  pas de whitelist. L'onboarding wallet (`bindWallet`, `onboarding/actions.ts:131`) devient
  obligatoire avant tout dépôt.
- **Créer** l'action admin `addToWhitelist(address)` → 5ᵉ site d'écriture on-chain, clé owner.
- **Nouveau mode d'échec à gérer dans l'UI** : approuvé en base, pas whitelisté on-chain →
  le dépôt **revert**. L'app doit lire `whitelist(address)` avant d'afficher le CTA.
- **Décider** : `AddressAllowlist` (0 ligne, inerte) devient-il le miroir DB de la whitelist
  on-chain, ou disparaît-il ?

### Lot 4 — Vérification & indexation (le vrai trou)

Indépendant de la forme du contrat, **obligatoire quelle qu'elle soit**.

- **`subscribe.ts:132` — receipt-check.** Aujourd'hui : regex de format seul. Il faut
  **décoder les logs** de la tx et vérifier : l'event `Deposit` vient bien du vault attendu,
  le montant correspond, le `receiver` est le wallet du caller.
  ⚠️ **Ne pas tester `tx.to === VAULT_ADDRESS`** — ça casse sur les wallets AA (prouvé : la
  seule tx réelle du repo passe par un EntryPoint ERC-4337).
- **Créer un indexeur d'events** — aucun code n'écoute les events du vault aujourd'hui.
  Viser la **nouvelle** signature `Deposit(address indexed user, uint256, uint256)`.
- **Créer un job de réconciliation chain↔DB** — aujourd'hui aucune divergence ne serait
  détectée. C'est ce qui a produit l'écart \$4,74M / 12 USDC.
- **Rattrapage tx-orpheline** (`invest-form.tsx:647-653`) : tx passée, Position absente,
  aucun retry. Avec un indexeur, ce trou se ferme tout seul.

### Lot 5 — Parcours user

- `invest-form.tsx:613-660` → adapter · `preflight-check.tsx:137-179` → adapter + **lire
  `allowance()` on-chain** (`:522` est un `useState` optimiste).
- `confirmed/page.tsx:41-70` → adapter ; **corriger la date d'unlock** (`:101`
  `daysFromNow(LOCK_DAYS)` recalculée à chaque rendu → **toujours aujourd'hui+60**).
- **Créer l'UI de retrait** (inexistante) + brancher `redeem()` sur `redeem`/`redeemProportional`.
  **Représenter honnêtement la falaise de liquidité** (§10.4 point 5).
- `portfolio/[positionId]/page.tsx:127` — ajouter `isPlaceholderTxHash`.
- **Décider du min-ticket de test** : 250k USDC Sepolia au faucet est irréaliste.

### Lot 6 — Admin & keeper

- **Keeper bot** — n'existe pas. `rebalance()`, `payElectricity()`, `runMonthlyEngine()`,
  `reportMiningMetrics()` sur cadence. Décider : cron Inngest + clé serveur, ou process séparé ?
  **Qui détient `KEEPER_PRIVATE_KEY` ?** ⚠️ **ADR-018** : *« Crews may read chain state,
  simulate, draft … but never hold a key, sign a transaction, or move funds. »* Un keeper
  automatique qui signe est **en tension directe** avec cette ligne rouge — à trancher
  explicitement dans l'ADR-019.
- **Nouvelle surface admin** : take-profit tiers, seuils de curtailment, halving month,
  vending curve, `elecPayee`/`monthlyElecCost`, `tvlCap`. **Rien de tout ça n'existe.**
- **`pause`/`resume`** (`admin/vaults/actions.ts:576-678`) : appeler les vrais appels, sinon
  l'état DB ment.
- **`engine/vaults.ts:56-71`** — APY 8-15% + allocations 60/25/10/5 en dur, consommés par
  **5 pages admin**. La spec impose **40/27/33**. ⚠️ **C'est le mensonge silencieux
  post-remplacement le plus probable** : ces pages continueront d'afficher les vieux chiffres
  quoi qu'il arrive on-chain.
- **`computeDistribution`** (`admin/distributions/actions.ts:97-100`) — bug P0 : split sur
  **toutes** les positions, pas filtré par `vaultRef`. Sort à décider avec §10.3.

### Lot 7 — Data layer

| Modèle | Décision |
|---|---|
| `Position.principalUsdc` | Reste source de vérité, **réconcilié** par l'indexeur |
| `Position.accruedYieldUsdc` | **Supprimable** — le NAV vient de `convertToAssets()` (spec §3) |
| `VaultSnapshot.aumUsdc` | Devient un **cache** de `totalAssets()`. ⚠️ pas de `vaultDeploymentId` → migration si multi-vault |
| `InvestorNavSnapshot` | 96 rows, 0 computed → **point naturel** pour brancher `convertToAssets()` (cadence + table déjà là) |
| `ShareClass` / `Subscription` | **0 writer atteignable, 0 reader → supprimables sans impact** |
| `Distribution*` / `Pcap` | Voir §10.3 |
| `AddressAllowlist` | Miroir de la whitelist on-chain, ou suppression (Lot 3) |
| **Prérequis** | Résoudre les **4 tables orphelines** (`Withdrawal`, `WithdrawalApproval`, `Institution`, `InstitutionMember` — reliquats du revert `a0ff3252`→`f6f9a5a5`) et les 2 `_prisma_migrations` à `finished_at = NULL` **avant** toute migration. ⚠️ Un `prisma migrate` pourrait proposer de les dropper |
| **Prérequis** | `db push`/`migrate` prod = **port direct 5432**, pas le pooler 6543. Et trancher la ref Supabase (ADR-010 dit `cnisndlptnuivupgxcmq`, README dit `xrwzxhsenwmlxbwqcftz`) |

### Lot 8 — Proof / attestation

- **Réparer les lectures chain AVANT tout** (Lot 1) — sinon `[]` systématique.
- **EventLogger et PoRRegistry sont des contrats distincts du vault** → remplacer le vault
  **ne les touche pas**. Bonne nouvelle : ce lot est largement isolé.
- ⚠️ **Le contenu attesté est MOCK** — clé Anvil, partenaire inventé, AUM en `sin()`, CID
  fabriqué. **Ancrer ces proofs écrirait des chiffres fictifs on-chain.** Il faut une vraie
  source d'attestation **OU** cesser d'exposer le bouton.
- Le Proof Center doit **cesser de présenter Fireblocks comme la custody du vault** (§10.1).

### Lot 9 — Doc (le même passage, pas après)

README (la promesse de distributions mensuelles, la ref Supabase, Persona→Sumsub),
`docs/spec/*`, méthodologie v2.0, `abi-freeze.json` (re-figer), `SYSTEM_MAP`,
`BACKEND_CONTEXT`, `UI_DATA_COVERAGE`, roadmap (aucun item de remplacement n'existe),
`redeem.ts:11-12` (`redeemFromVault` n'existe pas).

---

## 12. Ordre recommandé

```
Lot 0 (décider + ADR-019 + méthodo v2.0)
  └─> Lot 1 (hygiène — PEUT COMMENCER TOUT DE SUITE, indépendant de la spec)
        └─> Lot 2 (adapter + deploy testnet)
              ├─> Lot 3 (whitelist KYC)      ─┐
              ├─> Lot 4 (vérif + indexation) ─┼─> Lot 5 (user) ─> Lot 6 (admin/keeper)
              └─> Lot 7 (data layer)         ─┘
                                                  Lot 8 (proof) — isolé, parallélisable
                                                  Lot 9 (doc) — dans chaque lot, pas après
```

**Le Lot 1 ne dépend de rien.** Crons morts, seed \$2M en prod, registre qui ment, RPC
plafonné, KYC sandbox : tout ça est vrai aujourd'hui et le restera quel que soit le contrat.
C'est par là qu'il faut commencer pendant que la spec se stabilise.
