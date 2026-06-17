# BACKEND_CONTEXT — server actions, API, services, data

Charger ce fichier + l'`actions.ts` / `route.ts` ciblé + le module `src/lib/data/<x>` concerné.
Ne pas charger les composants ni le CSS.

## Où est quoi
- **Server actions** (`"use server"`) : `src/app/**/actions.ts` (23 fichiers). Principaux :
  `admin/vaults/actions.ts`, `admin/outreach/actions.ts`, `admin/distributions/actions.ts`,
  `admin/projection/actions.ts`, `admin/governance/allowlist/actions.ts`, `lib/governance/actions.ts`,
  `lib/auth/actions.ts`, `lib/views/actions.ts`, `lib/notifications/actions.ts`, `lib/onboarding/actions.ts`.
- **API routes** (18) : `src/app/api/**/route.ts`. Webhooks signés : `resend/webhook`, `docusign/webhook`,
  `typeform/webhook`, `hubspot/webhook`, `persona/webhook`. Jobs : `inngest/route.ts`. Chat : `cockpit-chat`,
  `chat-nav`, `admin/chat-tools`. PDF : `statements/[id]/pdf/route.tsx`.
- **Services / data** : `src/lib/data/` (portfolio 913 l., dashboard 726, cockpit 579 — fetch+derive),
  `src/lib/vaults/`, `src/lib/governance/`, `src/lib/distribution/`, `src/lib/proof-center/`,
  `src/lib/hubspot/`, `src/lib/inngest/` (jobs/crons), `src/lib/pdf/`, `src/lib/storage/` (Supabase).
- **DB** : `src/lib/db.ts` (singleton Prisma), `prisma/schema.prisma`. Dev = SQLite, prod = Supabase dédié.

## Règles
- Toute action/route mutante est **gardée** : `src/lib/auth/require-admin|require-auth|require-investor.ts`.
- Valider les inputs inline (enum + trim). Pas de `any`, pas de `as unknown as` — corriger le modèle.
- Mutation → `revalidatePath(...)`. Pas de fetch côté client, pas de `useEffect` pour data.
- `import "server-only"` en tête de tout module touchant `fs` / `prisma` (sinon fuite bundle client).
- **Engine pur** : `src/lib/engine/*` ne fait JAMAIS de prisma/fetch/Date.now/process.env/I/O — déterministe.
- Provenance : chaque métrique porte un badge (Live/Oracle/Attested/Estimated/Manual/Stale). Ne pas inventer.
- Webhooks : conserver la vérification de signature (HMAC/Resend/DocuSign). Ne pas désactiver.

## Validation backend
`pnpm test <glob du domaine>` (ex. `pnpm test governance`) + `pnpm typecheck`.
`pnpm build` seulement si une route ou le schéma Prisma change.

## STOP
Pas de migration DB (`db:push`/`db:migrate`), pas de mutation prod, pas de changement
permissions/CSP/auth sans demande explicite. Dev reste SQLite — régénérer le client après tout
`db:migrate` prod sinon les tests cassent.
