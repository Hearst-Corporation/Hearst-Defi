# AUTH_USERS_CONTEXT — auth / session / onboarding / KYC

Contexte pour l'agent Auth. Domaine **haute sécurité, lecture seule par défaut** : la plupart des
éditions ici exigent **STOP + accord explicite** (voir `docs/DO_NOT_TOUCH.md` → *Auth / gate*,
*Auth / wallet*). Lire ce fichier **avant** toute action sur `src/lib/auth/**`, `src/proxy.ts`,
`src/lib/onboarding/**`.

## Modèle d'auth

| Aspect | Réalité | Fichier |
|---|---|---|
| **Identité** | email/password, hash **argon2id** | `src/lib/auth/password.ts` |
| **Session** | cookie opaque `hc_session` = `Session.id` (cuid), **httpOnly**, lax, Secure en prod, **fenêtre glissante** | `src/lib/auth/session.ts` |
| **Pas de JWT, pas de crypto edge** | impossible au runtime Edge : pas de lookup DB | — |
| **Privy** | wallet **dépôt USDC uniquement**, **PAS** de l'authentification | `src/proxy.ts` (commentaire), `src/lib/auth/privy-config.ts` |

## Gate en couches — edge vs serveur

- **Edge** (`src/proxy.ts`) : ne voit que la **PRÉSENCE** du cookie `hc_session`. Pas de DB, pas de
  rôle, pas de `server-only`. Cookie absent sur route protégée → `loginRedirect` vers
  `/login?from=<path>` (anti open-redirect via `safeFrom`).
- **Serveur = AUTORITAIRE pour le RÔLE** : `require-admin.ts` (`role === "admin"`),
  `require-investor.ts`, `require-auth.ts`. L'enforcement `/admin` vit dans le **layout `/admin`**,
  jamais à l'edge.
- **`src/proxy.ts` est obligatoire** : Next 16 ignore **silencieusement** un `middleware.ts` racine
  (régression déjà réintroduite une fois — voir `DO_NOT_TOUCH`). Export `default function proxy`.

### Piège — deux listes synchronisées à la main
`PROTECTED_PREFIXES` (le test runtime `isProtected`) **ET** `config.matcher` dans `src/proxy.ts`
doivent **toujours coïncider**. Une route protégée ajoutée à **une seule** des deux **fuit**
silencieusement. Aujourd'hui les deux couvrent : `/admin`, `/debug`, `/onboarding`, `/portfolio`,
`/profile`, `/proof-center`, `/vaults`. Toute route protégée ajoutée → éditer **les deux**.

## TOTP (admins uniquement)

- Réservé aux **admins**. Secret chiffré **AES-256-GCM** avant persistance dans `User.totpSecret` ;
  clé `AUTH_TOTP_KEY` (**64 hex**). Voir `src/lib/auth/totp.ts`.
- **Anti-rejeu** : `totpLastUsedStep` — un step `<=` au dernier utilisé est refusé. Ne pas
  désarmer ce garde-fou.

## Persona KYC (P0-4) — la zone la plus sensible

- **NE JAMAIS faire confiance au `reference-id` du payload** : il est **client-supplied**
  (`src/app/api/persona/webhook/route.ts` l.155-158). Le `userId` autoritaire est résolu
  **uniquement** depuis le `KycInquiry` réclamé côté serveur (`claimKycInquiry`, appelé par l'UI
  onboarding via une server action authentifiée). Pas de claim → on refuse de persister/approuver.
- **`inquiryId` unique = idempotence** (`prisma.kycInquiry.findUnique({ where: { inquiryId } })`).
- **`markKycComplete` n'est DÉLIBÉRÉMENT PAS une `"use server"` action (D1)** : c'est une fonction
  **server-only interne** (`src/lib/onboarding/kyc-complete.ts`) appelée seulement par des callers
  de confiance. La convertir en action rouvre un **trou RPC d'auto-approbation** (self-approval).
  Ne pas la transformer.
- **3 chemins d'écriture KYC** doivent rester **cohérents** vers `Investor.kycStatus` :
  1. **webhook** Persona (`src/app/api/persona/webhook/route.ts`),
  2. **claim-replay** (claim tardif rejoue un `KycEvent` archivé),
  3. **admin override** manuel.
  Modifier un chemin sans aligner les deux autres = divergence d'état.

## Dev-bypass — double-gated

`isDevAuthBypass()` (`src/lib/dev-bypass.ts`) n'est `true` que si **`NODE_ENV !== "production"`
ET `DEV_AUTH_BYPASS === "1"`**. Jamais actif en prod (Next force `NODE_ENV=production` au build).
Court-circuite le gate edge et `getSession()` résout un investisseur dev seedé. Ne pas
relâcher l'une des deux conditions.

## Anti-énumération (password reset)

`src/lib/auth/password-reset.ts` : sur utilisateur **inconnu**, un **dummy-hash** est calculé et
l'email de reset est dispatché **fire-and-forget (NON awaited)** → la fonction retourne avant le
round-trip Resend. C'est une **défense par canal temporel** (timing-channel). **Conserver la
sémantique `await`** telle quelle : ne pas awaiter l'envoi, ne pas retirer le dummy-hash, ne pas
brancher de retour conditionnel selon l'existence de l'user.

## Validation

Pas de build. Réel = `pnpm test` ciblé sur les suites auth :
`auth-lifecycle`, `totp`, `password`, `session`, `auth-guards`, `kyc-gate`, persona `webhook`
(sous `src/lib/auth/__tests__/`, `src/lib/onboarding/__tests__/`, `src/app/api/persona/__tests__/`).

> **La plupart des éditions ici = STOP + accord explicite** (`DO_NOT_TOUCH`). Auth/session/KYC sont
> verrouillés : on lit, on diagnostique, on demande avant de modifier.
