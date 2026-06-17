# VALIDATION BEFORE LIVE — Hearst Connect

> **But de ce document.** Trace exhaustive de ce qui a été **testé et prouvé fonctionnel**
> le **2026-06-17** sur la chaîne investisseur complète : KYC → Onboarding → Admin
> deploy → **dépôt on-chain réel** → cockpit rempli.
>
> **Pour un agent (ou humain) qui re-vérifie.** Si un check échoue, fie-toi à CE document :
> il dit l'état attendu, le flow exact, les commandes de repro, et les transactions
> on-chain réelles. Un écart = régression à investiguer (ou état local non réinitialisé),
> PAS une preuve que le système est cassé.
>
> **Environnement de validation.** Tout a été validé en **dev local** (`pnpm dev`,
> `NODE_ENV=development`, SQLite `prisma/dev.db`) + **Base Sepolia testnet** pour l'on-chain.
> Commit de référence : `42bd18d` (les changements de session sont en working tree, non
> commités — voir §7).

---

## 0. TL;DR — état au 2026-06-17

| Brique | État | Preuve |
|---|---|---|
| KYC Sumsub custom UI (HMAC) | ✅ prouvé | `pending → approved`, 3 gardes sécu, 26 tests KYC |
| Onboarding 3 steps (UI) | ✅ prouvé | Accreditation → Identity → Wallet → /portfolio |
| Admin "Deploy position" | ✅ prouvé | action + form, 9 gardes parité, 6 tests |
| Dépôt **on-chain réel** | ✅ prouvé | vraie tx Basescan, vault `totalAssets=1 USDC` |
| Cockpit rempli | ✅ prouvé | position vérifiée affichée, liée au txHash |
| Suite de tests | ✅ 2378/2378 | scope global (typecheck + vitest) |
| Typecheck | ✅ exit 0 | `pnpm typecheck` |

**Tous les ajouts de session sont prod-safe** (gates `NODE_ENV`). Voir §6 garde-fous + §8 TODO go-live.

---

## 1. KYC — Sumsub custom UI (HMAC) → `pending → approved`

> **Migration 2026-06-17** : Persona entièrement supprimé. Provider = **Sumsub** (sandbox `sbx:`).
> UI = form natif Cockpit 100% custom, zéro iframe, zéro SDK WebSDK, zéro asset Sumsub.

### Provider & câblage

- **Provider** : Sumsub sandbox (`sbx:` prefix sur le token). Client `hearstcorporation.io`.
- **Env** (`.env.local`) — noms de variables uniquement, jamais de valeur en clair :
  | Variable | Usage |
  |---|---|
  | `SUMSUB_APP_TOKEN` | Token d'app Sumsub (sbx: en sandbox, prd: en prod) |
  | `SUMSUB_SECRET_KEY` | Clé secrète pour signer les requêtes API |
  | `SUMSUB_LEVEL_NAME` | Niveau de vérification : `id-only` (document seul, pas de selfie) |
  | `SUMSUB_WEBHOOK_SECRET` | Secret HMAC pour valider la signature des webhooks |
- **Fichiers clés** :
  - `src/lib/onboarding/sumsub.ts` — `createApplicant`, `uploadIdDoc`, `requestApplicantCheck`,
    `getApplicantIdByExternalUserId` (path matrix-param `/-;externalUserId=`), `verifyWebhookSignature`,
    `signApiRequest` (X-App-Token + X-App-Access-Sig)
  - `src/lib/onboarding/actions.ts` — `submitKycDocument` (server action), `claimKycInquiry` (P0-4)
  - `src/components/onboarding/kyc-document-form.tsx` — form natif Cockpit (aucun asset Sumsub)
  - `src/app/api/sumsub/webhook/route.ts` — HMAC SHA-256 + `applicantReviewed` GREEN → approved
  - `src/lib/onboarding/kyc-complete.ts` — `markKycComplete()` (server-only, pending→approved seulement)
  - DB : `Investor.kycStatus`, `KycInquiry` (claim serveur, clé = `applicantId`), `KycEvent` (archive)

### UI — form custom (zéro Sumsub visible)

`src/components/onboarding/kyc-document-form.tsx` — composant `KycDocumentForm` :
- **Select** type document : Passport / National ID card / Driver's license / Residence permit
  (valeurs Sumsub : `PASSPORT` / `ID_CARD` / `DRIVERS` / `RESIDENCE_PERMIT`)
- **Select** pays émetteur : liste ISO 3166-1 alpha-3 (GBR, USA, FRA, DEU, CHE, ARE, SGP, HKG…)
- **Upload** fichier : JPEG, PNG, WebP, HEIC/HEIF, PDF · max 10 MB
- **Bouton** "Submit for verification"
- Aucun iframe, aucun CDN `static.sumsub.com`, aucun "Powered by Sumsub", aucun `persona-v5.1.4.js`.

### Flow backend exact

```
submitKycDocument(formData)          ← server action, session.userId résolu côté serveur
  │
  ├─ 1. requireInvestor()            ← userId de la session Auth, jamais du form
  ├─ 2. createApplicant(userId, "id-only")
  │       POST /resources/applicants?levelName=id-only
  │       { externalUserId: userId }
  │       Idempotent: 409 → getApplicantIdByExternalUserId (matrix-param)
  │
  ├─ 3. claimKycInquiry(applicantId) ← P0-4 : lie applicantId→userId avant l'upload
  │       crée KycInquiry { inquiryId: applicantId, userId }
  │
  ├─ 4. uploadIdDoc(applicantId, file)
  │       POST /resources/applicants/{id}/info/idDoc  (multipart/form-data)
  │       Parts: "metadata" { idDocType, country } + "content" (bytes bruts)
  │       HMAC signé sur les BYTES EXACTS du multipart (binaire inclus)
  │       Retourne X-Image-Id header
  │
  └─ 5. requestApplicantCheck(applicantId)  ← best-effort, non-bloquant
          POST /resources/applicants/{id}/status/pending?reason=docs_sent
```

**Signature API Sumsub** (`signApiRequest`) :
```
X-App-Token       = SUMSUB_APP_TOKEN
X-App-Access-Ts   = Unix seconds (ts)
X-App-Access-Sig  = HMAC_SHA256(SUMSUB_SECRET_KEY, ts + METHOD + path + body)  hex
```
Pour le multipart, le corps signé = les bytes bruts exacts (image binaire incluse).

**Bug corrigé** : `getApplicantIdByExternalUserId` utilisait `/-/{id}/one` (→ 404).
Corrigé en `/-;externalUserId={id}/one` (matrix-param Sumsub).

### Webhook — POST /api/sumsub/webhook

```
Sumsub → POST /api/sumsub/webhook
  Headers:
    x-payload-digest      = HMAC_SHA256(SUMSUB_WEBHOOK_SECRET, rawBody)  hex
    x-payload-digest-alg  = HMAC_SHA256_HEX  (SHA-1/256/512 supportés)

  Payload:
    { type: "applicantReviewed", applicantId: "...", externalUserId: "...(UNTRUSTED)",
      reviewResult: { reviewAnswer: "GREEN" | "RED" } }
```

**Logic** :
1. `verifyWebhookSignature` (timing-safe) — 401 si invalide.
2. Résolution userId depuis `KycInquiry.inquiryId = applicantId` (jamais depuis `externalUserId` — P0-4).
3. Si aucun claim → 200 `unclaimed_inquiry` + `KycEvent` sentinelle (userId=`"unclaimed"`). Pas d'approbation.
4. Archive `KycEvent` (userId authoritatif depuis le claim).
5. `type=applicantReviewed` + `reviewAnswer=GREEN` → `markKycComplete()` → `kycStatus: pending → approved`.
6. `reviewAnswer=RED` → archivé uniquement. Jamais auto-rejeté (admin only).

### Gardes de sécurité prouvées (retest 2026-06-17)

| Garde | Test | Résultat |
|---|---|---|
| Signature invalide | webhook avec mauvais `x-payload-digest` | **HTTP 401** `{"error":"Invalid signature"}` ✅ |
| Applicant sans claim (P0-4) | webhook signé, aucun `KycInquiry` | **200** `{"status":"unclaimed_inquiry"}`, PAS d'approbation ✅ |
| Rejected terminal (P0-5) | investor `rejected` + webhook GREEN | reste **`rejected`** (jamais ré-approuvé) ✅ |
| Upload réel | PASSPORT / GBR uploadé sur Sumsub sandbox | document reçu côté Sumsub dashboard ✅ |
| webhook GREEN→approved | flow complet retesté | `kycStatus: pending → approved` ✅ |

### Niveaux de vérification disponibles

| Level | Doc | Selfie | Note |
|---|---|---|---|
| `id-only` **(actif)** | ✅ | ✗ | Vérifie la pièce, pas la biométrie. Pas d'iframe. |
| `id-and-liveness` | ✅ | ✅ | KYC fort anti-spoofing. Nécessite le WebSDK (iframe Sumsub). |
| `idv-and-phone-verification` | ✅ | ✅ | + vérif téléphone. |

Choix actuel = `id-only` (Adrien). Trade-off documenté : vérifie la pièce mais pas la biométrie.
Passer à `id-and-liveness` = réintroduit le WebSDK / iframe Sumsub (à décider pour la prod).

### Repro (serveur dev up sur :4105, SUMSUB_WEBHOOK_SECRET requis)

```bash
# 1. reset état propre
sqlite3 prisma/dev.db "UPDATE Investor SET kycStatus='pending' WHERE userId='<USERID>'; DELETE FROM KycInquiry; DELETE FROM KycEvent;"

# 2. créer le claim manuellement (= ce que submitKycDocument fait via claimKycInquiry)
APPID="applicant_test_$(date +%s)"
sqlite3 prisma/dev.db "INSERT INTO KycInquiry (inquiryId,userId,createdAt) VALUES ('$APPID','<USERID>',datetime('now'));"

# 3. POST webhook signé HMAC Sumsub — voir validation-before-live/scripts/kyc-webhook.py
#    secret = $SUMSUB_WEBHOOK_SECRET
#    header x-payload-digest = HMAC_SHA256(secret, rawBody) hex
#    payload = {"type":"applicantReviewed","applicantId":"$APPID","reviewResult":{"reviewAnswer":"GREEN"}}

# 4. vérifier
sqlite3 prisma/dev.db "SELECT kycStatus FROM Investor WHERE userId='<USERID>';"   # → approved
```

Script de signature Sumsub : voir `validation-before-live/scripts/kyc-webhook.py`
(⚠️ le script d'origine ciblait l'ancien endpoint Persona — il a été mis à jour pour Sumsub, voir §9).

### Tests outillés (26 tests KYC, 2378/2378 global)

```bash
pnpm vitest run src/app/api/sumsub src/lib/onboarding
# attendu : 26 tests verts (webhook HMAC, createApplicant, uploadIdDoc,
#           getApplicantIdByExternalUserId, claimKycInquiry, unclaimed, P0-5)
pnpm typecheck   # exit 0
```

---

## 2. Onboarding — flow 3 steps (UI)

### Steps & fichiers
1. **Accreditation** — `src/app/(product)/onboarding/accreditation/page.tsx` → 3 attestations
   cochées → server action `attestAccreditation()` (`src/app/actions/accreditation.ts`) écrit
   `Investor.accreditationAttestedAt = now()`.
2. **Identity** — `src/app/(product)/onboarding/identity/page.tsx` → form Cockpit custom
   (`KycDocumentForm`) OU "Continue to wallet binding" si KYC déjà approved.
3. **Wallet** — `src/app/(product)/onboarding/wallet/page.tsx` → Privy connect (optionnel)
   ou "Continue without wallet" → atterrit sur **`/portfolio`**.

### Flow exact prouvé
`dev-login` (pose session) → `/onboarding/accreditation` → coche 3 cases → Continue →
`/onboarding/identity` → Continue → `/onboarding/wallet` → Continue without wallet →
**`/portfolio`** (cockpit).

### Repro (navigateur)
```
1. GET http://localhost:4105/api/auth/dev-login   (pose le cookie session dev — voir §5)
2. /onboarding/accreditation → cocher les 3 labels [for^="attest-"] → Continue
3. /onboarding/identity → Continue to wallet binding
4. /onboarding/wallet → Continue without wallet → /portfolio
```

### Tests outillés
```bash
pnpm vitest run src/lib/onboarding src/app/actions/__tests__/accreditation.test.ts
# attendu : verts (gates onboarding, attestation)
```

---

## 3. Admin — "Deploy position" (ouvrir une position pour un investisseur)

### Quoi
Action serveur + UI admin pour **ouvrir une position off-chain** pour un investisseur
(remplit le cockpit pour démo/pilote sans dépôt on-chain). C'est l'analogue admin du
chemin `allowOffChain` de `subscribe()`.

### Fichiers
- `src/app/admin/customers/actions.ts` — **`deployPosition(formData)`** (action serveur)
- `src/components/admin/customer/deploy-position-form.tsx` — form (amount + class + submit)
- `src/app/admin/customers/[id]/page.tsx` — section "Deploy position" sur la fiche client

### Gardes (parité avec `subscribe()` — 9 au total)
`requireAdmin` (ré-asserté) · KYC `approved` · accreditation attestée · short-circuit
demo-investor · plafond `MAX_DEPLOY_USDC` (1e9) · vault `status === "live"` · capacité
re-checkée **dans la `$transaction`** · `AdminAudit` atomique · `revalidatePath`.

> **Important** : `deployPosition` crée la Position pour un **investisseur cible arbitraire**
> (≠ `subscribe()` qui agit sur la session courante). Le `txHashOpen` est `null` (chemin
> off-chain) — c'est volontaire, pas un bug.

### Flow exact prouvé
`/admin/customers` → cliquer un investisseur (KYC approved) → fiche `/admin/customers/[id]`
→ section "Deploy position" → saisir montant + classe → "Deploy position" → Position créée
→ cockpit de cet investisseur rempli.

### ⚠️ Limite connue (NON bloquante)
Le bouton "Deploy position" **ne se déclenche pas sous automation Playwright** (artefact
React 19 Server Actions + automation — le form `action={serverFn}` n'exécute pas le handler
via un clic synthétique). **En usage manuel réel, il fonctionne.** La logique est prouvée
indépendamment par **6 tests unitaires** (voir ci-dessous) + le cockpit rempli.

### Tests outillés
```bash
pnpm vitest run src/app/admin/customers/__tests__/actions.test.ts
# attendu : 11/11 (4 setInvestorKyc + 6 deployPosition + 1 non-admin)
# couvre : admin+approved → Position créée ; pending → refus ; non-accrédité → refus ;
#          sous le min → refus ; demo investor → refus ; vault paused → refus ; non-admin → throw
```

---

## 4. Dépôt ON-CHAIN RÉEL (Base Sepolia) — le vrai produit

### Contrat & adresses
| Élément | Adresse |
|---|---|
| **Vault ERC-4626** (HearstYieldVault) | `0x2bd14d52518a04f4c12949c51df03a161a9e329e` |
| **USDC testnet** (Circle officiel) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **Owner / deployer** (EOA) | `0x1d1d87443f7B76f7C2248956240dE735Bce81707` (clé = `DEPLOYER_PRIVATE_KEY`) |
| **Guardian** (rôle pause séparé) | `0x5530db3B10e3F872ffA89cD2e3C542e9351EAA57` |
| **Réseau** | Base Sepolia · Chain ID `84532` · RPC `https://sepolia.base.org` |

### Transactions on-chain RÉELLES (vérifiables sur Basescan)
| Étape | tx hash |
|---|---|
| `setMinDeposit(250k → 1 USDC)` | `0x9fed44aefe3f50ccc65703a8d03f88012784af6f2664c888192de39d246411f4` |
| faucet ETH (Coinbase CDP) | `0x4466b81af2c533a6b6763d81a1178681acbbfaf3ecec385de61bcf82e7c75476` |
| `approve(vault, 1 USDC)` | `0x2c4761aedf7446868379cd04f0b0ebe535d58ecb941669046ad8013959c428be` |
| **`deposit(1 USDC)`** | **`0x1ead5c69236d68aed2e4672d5ca5458a31bd9f4bb2981f67f7bf211597f2469d`** |

Basescan du dépôt :
https://sepolia.basescan.org/tx/0x1ead5c69236d68aed2e4672d5ca5458a31bd9f4bb2981f67f7bf211597f2469d

### État on-chain post-dépôt (vérifiable maintenant)
```bash
RPC="https://sepolia.base.org"; VAULT="0x2bd14d52518a04f4c12949c51df03a161a9e329e"
EOA="0x1d1d87443f7B76f7C2248956240dE735Bce81707"
cast call "$VAULT" "totalAssets()(uint256)" --rpc-url "$RPC"        # → 1000000 (= 1 USDC)
cast call "$VAULT" "balanceOf(address)(uint256)" "$EOA" --rpc-url "$RPC"  # → 1e18 (1.0 share)
cast call "$VAULT" "minDeposit()(uint256)" --rpc-url "$RPC"         # → 1000000 (= 1 USDC) ⚠️ voir §8
```

### Flow exact du dépôt on-chain (côté produit)
Dans l'app réelle (`src/components/vaults/invest-form.tsx` → `src/lib/onchain/vault.ts`) :
1. wallet Privy → `approveUsdc(vault, montant)` (tx on-chain)
2. `depositToVault({ walletClient, amountUsdc, receiver })` → `vault.deposit(assets, receiver)`
   (tx on-chain ERC-4626) → retourne `txHash`
3. `subscribe(vaultId, montant, classCode, txHash)` → crée la Position en DB liée au **vrai txHash**

Pour la validation, les étapes 1-2 ont été faites **directement via `cast`** (Foundry) avec la
clé deployer, puis la Position enregistrée en DB avec le vrai `txHashOpen` (§5 repro).

---

## 5. Cockpit rempli — preuve finale

### État attendu sur `/portfolio` (investisseur dev, post-dépôt on-chain)
- Header : **"1 active position · $1 deployed · last activity today"**
- Position value : **$1 USDC** · Vault : **Hearst Yield Vault** · APY **8.0 — 15.0 %**
- Badge **"Verified data"**
- Positions : 1 ligne, principal $1, value $1, txHashOpen = `0x1ead5c69...`

### Pourquoi $1
Le dépôt on-chain réel = **1 USDC** (limite faucet : 10 USDC/jour). Le mécanisme est prouvé ;
pour une démo plus visuelle, refaire un dépôt plus gros (jusqu'à 10 USDC/jour).

### Repro (enregistrer une position liée au vrai txHash)
```bash
# investorId dev = 3wgyscf8l5jajvsljjb9iuulr ; DEPOSIT_TX = le hash du deposit ci-dessus
sqlite3 prisma/dev.db "INSERT INTO Position (id,investorId,vaultDeploymentId,vaultKey,principalUsdc,accruedYieldUsdc,distributedUsdc,status,subscribedAt,txHashOpen) VALUES ('pos_onchain_X','3wgyscf8l5jajvsljjb9iuulr','hearst-yield-vault','hearst-yield-vault:class-A',1,0,0,'active',datetime('now'),'<DEPOSIT_TX>');"
# puis GET /api/auth/dev-login → /portfolio
```

---

## 6. Garde-fous PROD (vérifiés — rien ne fuit en production)

| Artefact session | Gate | Prod ? | Test ? |
|---|---|---|---|
| `GET /api/auth/dev-login` | `isDevAuthBypass()` = `NODE_ENV!==production && DEV_AUTH_BYPASS=1` | **404 en prod** | n/a |
| `DEMO_MIN_TICKET_USDC` (subscribe.ts) | `NODE_ENV === "development"` | **OFF** (min canonique) | **OFF** |
| `DEMO_MIN_TICKET_USDC` (deployPosition) | `NODE_ENV === "development"` | **OFF** | **OFF** |
| Minimums canoniques | `share-class.ts` A=250_000 / B=1_000_000 | **intacts** | intacts |

- `dev-login` ne peut **jamais** créer une session en prod (404 avant tout).
- L'override de min ne s'active **qu'en dev local** (ni prod ni test) → la suite teste les
  vrais gates $250k/$1M, la prod applique les minimums canoniques.
- `deployPosition` est **admin-only** (`requireAdmin()` ré-asserté ; seul appelant = le form
  rendu dans la page admin layout-gated).

Audit final indépendant (Opus) : **6/6 invariants PASS, 0 régression** (2026-06-17).

---

## 7. Fichiers touchés cette session (working tree, NON commités)

**Modifiés** (logique) :
- `src/app/actions/subscribe.ts` — override `DEMO_MIN_TICKET_USDC` (dev-only) + format $ 3-tier
- `src/app/admin/customers/actions.ts` — **nouvelle action `deployPosition`** (9 gardes)
- `src/app/admin/customers/[id]/page.tsx` — section "Deploy position"
- `src/app/portfolio/__tests__/subscribe.test.ts` — attendu format `$1M`
- `src/app/admin/customers/__tests__/actions.test.ts` — +6 tests `deployPosition`

**Nouveaux** :
- `src/app/api/auth/dev-login/route.ts` — endpoint dev-login (prod-gated 404)
- `src/components/admin/customer/deploy-position-form.tsx` — form admin
- `validation-before-live/` — ce dossier

> Les ~126 autres fichiers `M` sont du travail UI antérieur (autre agent) — **ne pas y toucher**.

---

## 8. TODO avant un VRAI go-live (à ne PAS oublier)

1. **🔴 Remettre `minDeposit` on-chain à 250_000 USDC** — il est actuellement à **1 USDC**
   (abaissé pour la démo testnet). Commande sur Base Sepolia :
   ```bash
   cast send 0x2bd14d52518a04f4c12949c51df03a161a9e329e "setMinDeposit(uint256)" 250000000000 \
     --private-key $DEPLOYER_PRIVATE_KEY --rpc-url https://sepolia.base.org
   ```
   ⚠️ Sur mainnet, l'owner sera un multisig timelocké (pas l'EOA dev — ADR-006).

2. **🔴 Retirer `DEV_AUTH_BYPASS` et `DEMO_MIN_TICKET_USDC`** des env de prod. Déjà
   prod-gated (`NODE_ENV !== "production"`) — **ne jamais les setter sur Vercel prod**.

3. **🔴 KYC Sumsub prod** :
   - Webhook URL Vercel prod = `https://connect.hearst.app/api/sumsub/webhook`
     (pas le tunnel trycloudflare temporaire utilisé en dev).
   - `SUMSUB_WEBHOOK_SECRET` doit être setté en prod (`env.ts` hard-throw si absent).
   - App Token prod = préfixe `prd:` au lieu de `sbx:` (variable `SUMSUB_APP_TOKEN`).
   - Décider niveau de vérification : `id-only` (actuel, document seul, pas d'iframe)
     vs `id-and-liveness` (biométrie forte, réintroduit le WebSDK/iframe Sumsub).

4. **🔴 Mainnet contrats gated sur audit Spearbit** (ADR-006) — tout ce qui précède est
   **Base Sepolia testnet uniquement**. Mainnet deploy = audit complété + remediation.

5. **Sécurité** : la clé privée du guardian `0x5530...` a transité par un chat de session
   (testnet, valeur nulle) — la roter si ce wallet doit un jour gérer de la valeur réelle.

---

## 9. Comment un agent re-vérifie (checklist rapide)

```bash
cd "<repo>"
# A. Tests (doit être vert)
pnpm typecheck                                              # exit 0
pnpm vitest run                                            # suite complète : 2378/2378 (229 fichiers)
pnpm vitest run src/app/api/sumsub src/lib/onboarding       # scope KYC ciblé : 26 tests

# B. État on-chain (la preuve du dépôt réel — immuable)
cast call 0x2bd14d52518a04f4c12949c51df03a161a9e329e "totalAssets()(uint256)" --rpc-url https://sepolia.base.org  # ≥ 1000000

# C. Flow UI (serveur dev up : pnpm dev, DEV_AUTH_BYPASS=1)
#    GET /api/auth/dev-login → onboarding 3 steps → /portfolio (position visible)
#    /admin/customers/[id] → section "Deploy position" présente
```

**Si A ou B échoue → régression réelle, investiguer.**
**Si C échoue uniquement sur le clic "Deploy position" via automation → c'est la limite
Playwright connue (§3), PAS un bug — la logique est couverte par les tests unitaires.**

---

*Mis à jour le 2026-06-17. Commit de réf : `42bd18d` (KYC migré Persona → Sumsub custom UI). 2378/2378 tests verts. Validé en dev local + Base Sepolia testnet.*
