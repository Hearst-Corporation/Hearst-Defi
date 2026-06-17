# OWNERSHIP_MATRIX — qui possède quoi, qui review, qui est interdit

Avant de toucher un fichier : trouver son **domaine** ci-dessous. L'owner conduit, le reviewer valide,
les agents interdits ne committent pas dans ce périmètre. Respecter le **STOP** de chaque ligne.

## Matrice

| Domaine | Owner | Reviewer | Agents interdits | STOP |
|---|---|---|---|---|
| **DS / tokens** — `cockpit-shell/tokens.css`, `src/app/cockpit.css`, `globals.css @theme`, `tokens-layer.css`, `doc-flow.css` | Design-System | UI-Layout | Backend, DeFi, Agent-Arch | Un seul vert `--ct-accent` #A7FB90. La valeur live gagne dans `cockpit.css :root` (non-layered) ≠ base `tokens-layer.css`. Pas de `dark:`. |
| **Pages / nav** — `src/app/(product\|admin)/**/*.tsx`, `src/components/nav/product-nav-items.ts` | UI-Layout | Design-System | Backend, DeFi | Server Components par défaut. Pas de logique métier hors engine. Pas de fetch client / `useEffect` data. |
| **Server Actions / API** — `src/app/**/actions.ts`, `src/app/api/**/route.ts`, `src/lib/admin/audit.ts`, `src/lib/rate-limit.ts` | Backend | Auth | UI-Layout, Design-System | Chaque action ré-asserte `requireAdmin()`/`requireInvestor()`/`requireAuth()` en 1ʳᵉ ligne. Pas de migration DB. |
| **Auth / KYC** — `src/proxy.ts`, `src/lib/auth/*`, `src/lib/onboarding/kyc-complete.ts`, `src/app/api/persona/webhook` | Auth | Backend | UI-Layout, DeFi, Agent-Arch | Le gate vit dans `src/proxy.ts` (jamais `middleware.ts`). Vérif signature webhook conservée. Zéro confiance client. |
| **Agents / LLM** — `src/lib/llm/*`, `src/lib/agents/*`, `src/app/api/cockpit-chat/route.ts` | Agent-Arch | Proof/Compliance | UI-Layout, DeFi | OpenAI GPT-4.1 (ADR-011), un seul modèle. Exports `kimi`/`KIMI_*` pointent OpenAI — ne pas « réparer ». Pas d'outils write/financial. |
| **DeFi / engine** — `src/lib/engine/*`, `src/lib/onchain/*`, `src/app/actions/subscribe.ts`+`redeem.ts`, `contracts/**` | DeFi | Proof/Compliance | UI-Layout, Design-System | Engine pur : no prisma/fetch/`Date.now()`/`process.env`/I/O. PRNG seedé. Mainnet hors-scope (gate Spearbit, ADR-006). |
| **Proof / compliance** — `src/components/ui/provenance-badge.tsx`, `src/lib/chain/*`, `src/lib/attestation/*`, `src/lib/llm/output-guard.ts`, `src/lib/agents/forbidden-words.ts` | Proof/Compliance | Auth | UI-Layout, Email | APY en range. Mots interdits filtrés. Provenance jamais inventée. Disclaimer « not guaranteed » obligatoire. |
| **Email** — `src/lib/email/*`, `src/app/admin/outreach/actions.ts`, `src/lib/inngest/functions/outreach-send.ts` | Email | Backend | UI-Layout, DeFi | Pas d'envoi public sans accord explicite. Vérif signature Resend conservée. |
| **Build / config** — `next.config.ts`, `prisma.config.ts`, `package.json`, `src/lib/env.ts`, `src/lib/db.ts` | Build-Steward | Backend | tous les autres | CSP / deps / migration = étape discrète et isolée. Pas de `tailwind.config.js`. Dev reste SQLite. |

## Règles transverses (s'appliquent à TOUTES les lignes)

- **Le guard de layout `(product)`/`admin` ne suffit PAS.** Chaque Server Action est une **surface RPC publique** :
  elle DOIT ré-asserter `requireAdmin()` / `requireInvestor()` / `requireAuth()` comme **première instruction**,
  jamais se reposer sur le layout parent.
- **Source unique de l'identité signer admin** : toujours dérivée serveur via `admin.walletAddress ?? admin.userId`
  (cf. `src/app/admin/customers/actions.ts`, `src/app/admin/signals/actions.ts`) — **jamais** fournie par le client.
- **Staging chirurgical only.** `git add <chemins exacts>` du lot ; jamais `-A`/`-u`/`.`.
  `pnpm commit:check` doit montrer un index **mono-domaine** avant tout commit (cf. `docs/DO_NOT_TOUCH.md`).

## 8 règles d'escalade

1. **DO_NOT_TOUCH** atteint → **STOP dur**, signaler, ne pas contourner.
2. **Édition deux-owners** (page + actions, ou `cockpit.css` + CSS de page, ou engine + output-guard) →
   l'owner au **plus grand blast-radius conduit**, l'autre review.
3. **Non-négociables compliance** (range APY, mots interdits, provenance, pureté engine, disclaimer) →
   **veto Proof/Compliance**.
4. **Coutures sécurité** (auth, webhooks, RPC) → **veto Auth/Backend**, zéro confiance client.
5. **Build / CSP / migration** → **étape discrète Build-Steward**, isolée, jamais en passager.
6. **Contracts / mainnet** → **hors-scope** (gate audit Spearbit, ADR-006) — testnet Base Sepolia uniquement.
7. **Doc périmée / gap connu** → **reporter, ne pas agir**.
8. **Fichier d'un autre owner / zone sensible dans l'index** → **STOP**, `git restore --staged`,
   ne jamais committer le travail d'autrui « au passage » (staging chirurgical, cf. DO_NOT_TOUCH).

## Validation par domaine

`pnpm typecheck` + `pnpm test <glob du domaine>` (ex. `pnpm test governance`) + visuel.
`pnpm build` seulement si une route, le schéma Prisma, ou un fichier Build/config change.
`lint` = `eslint src || true` (advisoire — pas la vraie barrière).
