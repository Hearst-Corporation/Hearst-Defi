# Hearst Connect — Déploiement & Rollback

> **Vérité runtime (vérifiée 2026-06-15).** La production est servie par **Vercel**,
> pas Railway. Les en-têtes HTTP de `https://connect.hearst.app` renvoient
> `server: Vercel` / `x-vercel-id`, et `.vercel/project.json` lie le repo au projet
> Vercel `hearst-connect`. Toute la documentation Railway/Docker antérieure était
> obsolète et a été retirée. Voir « Héritage Railway » en bas.

## Plateforme cible

**Vercel** (projet `hearst-connect`). Le repo est lié via `.vercel/project.json`
(`projectId` + `orgId`, sans valeur sensible versionnée).

## Source de déploiement

**Intégration Git Vercel.** Vercel observe le repo GitHub et déploie automatiquement :

- **Production** : tout `push`/`merge` sur **`main`** → déploiement production sur
  `https://connect.hearst.app`.
- **Preview** : tout push sur une autre branche / PR → déploiement Preview jeté
  (URL `*.vercel.app` éphémère).

Il n'y a **pas** de workflow GitHub Actions qui déploie. Le déploiement est piloté
de bout en bout par l'intégration Git de Vercel. (L'ancien `deploy.yml` qui
prétendait déployer sur Railway était un workflow zombie — 0 succès / 100 runs —
et a été **supprimé** le 2026-06-15.)

> ⚠️ **Conséquence importante.** Le déploiement Vercel n'est PAS bloqué par la CI
> GitHub depuis le repo seul. Pour qu'un merge sur `main` n'expédie pas du code
> non validé en production, la **branch protection GitHub** doit exiger `ci.yml`
> avant merge (voir « Required external settings »). C'est un réglage console, pas
> un fichier du repo.

## Validation attendue avant merge sur `main`

La CI GitHub `.github/workflows/ci.yml` est le gate de qualité. Jobs :

1. **Lint & Typecheck** (bloquant) — `pnpm lint` (eslint + DS layout gate) + `pnpm typecheck`.
2. **Vitest** (bloquant) — `pnpm test` (unit + integration sur SQLite éphémère).
3. **Playwright E2E** (non bloquant) — `continue-on-error: true`.
4. **Foundry** (bloquant quand `contracts/` est touché) — `forge build` + `forge test`.

Avant d'ouvrir une PR vers `main`, faire tourner en local :

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm build        # build production (Next standalone non requis sur Vercel)
```

## Preflight prod-readiness

`pnpm preflight` (`scripts/preflight-prod.mjs`) vérifie les secrets P0/P1 attendus
en production et signale :

- `DATABASE_URL` pointant sur une DB locale (doit être Postgres en prod),
- secrets P1 manquants (voir « Required external settings »).

Le preflight **n'est plus dans un pipeline de déploiement** (il était câblé dans le
`deploy.yml` supprimé). C'est désormais un outil de **vérification manuelle de
prod-readiness** à lancer avant un merge sensible. Il sort en code 1 si un P0
manque — utile en pre-merge check local, pas un gate automatique.

## Variables d'environnement de production

Les variables de production sont configurées dans **Vercel → projet `hearst-connect`
→ Settings → Environment Variables** (scope `Production`). Aucune valeur sensible
n'est versionnée dans le repo.

### Obligatoires (P0 — le preflight échoue sans elles)

- `DATABASE_URL` (Postgres prod)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `INNGEST_SIGNING_KEY`
- `PERSONA_WEBHOOK_SECRET`
- `NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`

### Build-time (inline par Next.js)

- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_CHAIN_RPC_URL`
- `NEXT_PUBLIC_EVENT_LOGGER_ADDRESS`
- `NEXT_PUBLIC_POR_REGISTRY_ADDRESS`
- `NEXT_PUBLIC_SENTRY_DSN`

### Recommandées (P1 — feature fail-closed sans elles)

- `DOCUSIGN_WEBHOOK_SECRET` — le webhook DocuSign fail-closed au runtime tant qu'absent.
- `ATTESTATION_ALLOWED_SIGNERS` — la vérification d'attestation renvoie `no_allowlist_configured`.
- `AUTH_TOTP_KEY` — le login admin TOTP échoue tant qu'absent.

### Intégrations tierces & admin

- `PRIVY_APP_SECRET`
- `FIREBLOCKS_API_KEY`, `FIREBLOCKS_BASE_URL`, `FIREBLOCKS_VAULT_ACCOUNT_IDS`, `FIREBLOCKS_SECRET_KEY_PATH`
- `ADMIN_EMAILS`, `ADMIN_INITIAL_PASSWORD`, `ADMIN_ADDRESSES`, `HEARST_PUBLISHER`
- `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- `LOG_LEVEL`, `DEMO_MODE_DEFAULT`

## Rollback

Le déploiement étant piloté par Git → Vercel, le rollback se fait par Git ou par
le dashboard Vercel.

### 1. Rollback via Git (recommandé en cas d'erreur de code)

```bash
# Identifier le commit fautif
git log --oneline

# Revert et pousser sur main — Vercel redéploie automatiquement la version revertée
git revert <COMMIT_HASH>
git push origin main      # (via PR si la branch protection l'exige)
```

### 2. Rollback instantané via Vercel (urgence)

1. Vercel → projet `hearst-connect` → onglet **Deployments**.
2. Sélectionner un déploiement production **antérieur** réussi.
3. **… → Promote to Production** (ou « Rollback »). Restaure l'image servie sans
   nouveau build.

> Le rollback Vercel ne touche pas la base de données. Pour un rollback DB, voir
> « Base de données » ci-dessous.

## Base de données

Le schéma est appliqué via `prisma db push` (state-driven, pas de migrations
versionnées). Conséquence : **pas d'historique de migration en production** — le
rollback DB se fait par restauration d'un backup du provider Postgres, pas par
migration inverse.

- **Snapshot manuel avant un `db push` à risque** (drop colonne, type change) :

  ```bash
  pg_dump "$DATABASE_URL_PROD" --no-owner --no-acl > backup-$(date +%Y%m%d-%H%M%S).sql
  ```

  Stocker hors-repo (S3, Drive). **Ne jamais versionner un dump SQL.**

- Les backups/PITR dépendent du provider Postgres utilisé (Supabase en prod selon
  CLAUDE.md). Vérifier la rétention et le PITR dans la console du provider.

- **Évolution recommandée** vers une vraie traçabilité : générer un set de
  migrations Postgres (`prisma migrate dev`), basculer `migration_lock.toml` en
  `postgresql`, et remplacer `db push` par `migrate deploy` dans le process de
  release.

## Healthcheck

`GET /api/health` — sonde de liveness légère (`src/app/api/health/route.ts`).
Retourne HTTP 200 `{ "status": "ok" }`. Aucune requête DB, aucune auth, aucun
appel externe — confirme uniquement que le serveur Next.js répond. Rendu
`force-dynamic` pour éviter toute réponse mise en cache.

```bash
curl https://connect.hearst.app/api/health
# → {"status":"ok"}
```

Compatible monitoring uptime externe (UptimeRobot, Checkly, etc.) en ciblant
cette URL avec une assertion HTTP 200.

## Observabilité (Sentry)

Sentry capte les exceptions runtime (client + serveur + edge). Configuration
volontairement **error-only et prod-only** (Replay retiré, ingestion désactivée en
dev — voir mémoire projet / réglage 2026-06-13). Le `connect-src` CSP dérive
l'ingest du DSN.

Pour les alertes : Sentry → projet `hearst-connect` → **Alerts**. Le script
`scripts/setup-sentry-alerts.sh` POSTe un set de règles via l'API (idempotent ;
nécessite un token scope `alerts:write`).

## Crons & webhooks (couche « manage »)

Ces surfaces tournent en continu côté serveur, indépendamment du déploiement :

- **Inngest** — route serve exposée à `/api/inngest`. Crons : `mining-health-daily`,
  `risk-daily`, `investor-memo-monthly` ; chaînes événementielles
  `risk.daily.completed → rebalancing-signal`, `distribution.executed`. Nécessite
  `INNGEST_SIGNING_KEY` (validé au boot en prod).
- **Webhooks entrants** — `/api/docusign/webhook` (HMAC-SHA256), `/api/persona/webhook`
  (HMAC-SHA256 + fraîcheur timestamp). Voir secrets P1 ci-dessus.

## Pre-deploy checklist (avant merge sur `main`)

- [ ] Tests locaux verts : `pnpm typecheck && pnpm lint && pnpm test`
- [ ] Build local OK : `pnpm build`
- [ ] Preflight prod-readiness : `pnpm preflight` (DB locale + secrets P1 attendus signalés)
- [ ] (Optionnel) E2E réel : `pnpm seed:test && pnpm test:e2e`
- [ ] Si schéma Prisma modifié : snapshot DB prod via `pg_dump`
- [ ] Secrets Vercel à jour (Settings → Environment Variables → Production)
- [ ] Sentry alert rules actives
- [ ] CI `ci.yml` verte sur la PR avant merge

## Post-deploy smoke (production)

Après push sur `main`, Vercel redéploie automatiquement sur **https://connect.hearst.app**.

```bash
curl -sf https://connect.hearst.app/api/health   # HTTP 200 {"status":"ok"}
```

Vérifications manuelles (session investor ou admin requise) :

- `/proof-center` — PoR, mining cash-flow, distributions, rebalancing PTAI, catalog off-chain
- `/admin/proof-center` — surface opérateur alignée

Vérifier le SHA déployé : GitHub → **Deployments** (environment `Production`) ou
Vercel → projet `hearst-connect` → **Deployments** (doit matcher `main`).

## Required external settings (NON garantis par le repo seul)

Ces réglages vivent dans les consoles GitHub / Vercel. Le diff repo ne peut PAS les
appliquer ; ils doivent être **vérifiés manuellement** dans les UI.

1. **GitHub → Settings → Branches → Branch protection sur `main`**
   - Exiger les status checks `ci.yml` (Lint & Typecheck, Vitest, Foundry) **avant merge**.
   - Exiger une PR (pas de push direct sur `main`) + au moins 1 review si la capacité du repo le permet.
   - Objectif : garantir qu'aucun code non validé par CI ne parte en production Vercel.

2. **Vercel → projet `hearst-connect` → Settings → Git**
   - Production Branch = **`main`** (et seulement `main`).
   - Vérifier que les autres branches ne produisent que des Preview deployments.

3. **Secrets prod manquants à provisionner** (signalés par `pnpm preflight`,
   sinon features fail-closed en prod) :
   - `DOCUSIGN_WEBHOOK_SECRET`
   - `ATTESTATION_ALLOWED_SIGNERS`
   - `AUTH_TOTP_KEY`

---

## Héritage Railway (décommissionné)

La production n'a jamais tourné sur Railway en pratique. Les artefacts Railway/Docker
ont été **définitivement supprimés** du repo :

- `railway.toml` — supprimé
- `Dockerfile` — supprimé
- `docker-compose.yml` — supprimé
- l'option conditionnelle `output: "standalone"` de `next.config.ts` (pilotée par
  `STANDALONE_BUILD`) — supprimée

Le seul chemin de déploiement est **Vercel** (intégration Git, auto-deploy à chaque
push sur `main`). Aucun artefact Railway ou Docker ne subsiste dans le repo.

## E2E — user de test seedé

Le spec `e2e/login-flow.spec.ts` exerce le vrai chemin d'authentification (login
form → server action → argon2id → `Session` DB → cookie `hc_session`). Il a besoin
d'un user seedé :

```bash
pnpm seed:test            # crée/maj test@hearst.local (refuse NODE_ENV=production)
pnpm test:e2e login-flow  # ou tous les specs : pnpm test:e2e
```

| Constante | Valeur |
|---|---|
| `TEST_USER_EMAIL` | `test@hearst.local` |
| `TEST_USER_PASSWORD` | `TestPassword123!` |
| Rôle | `investor` |
| KYC | `approved` |
