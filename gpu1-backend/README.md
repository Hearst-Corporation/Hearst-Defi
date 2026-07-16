# gpu1-backend — Hearst Connect business back-end (GPU1)

**PROMPT 219 — pivot GPU1 confirmé.** This is the *physically separate* business
back-end that Hearst Connect's frontend consumes. It owns every business read and
write; the frontend (Client **and** Server Components, Server Actions, Route
Handlers) never touches Prisma / Supabase / RPC / providers directly.

```
Sources externes / smart contract v2 (futur)
        ↓  indexers/  workers/
gpu1-backend (this service)
        ↓  persistence/  (Prisma)
Supabase PostgreSQL  ← SAME canonical prod DB, not duplicated
        ↓  api/  (Fastify + Zod DTOs)
Frontend Connect  (src/lib/gpu1-client — the only business data source)
```

## Why it lives in this monorepo

GPU1 already runs a GitHub Actions runner scoped to this repo
(`Hearst-Corporation-Hearst-Defi.gpu1-defi`) and the canonical per-app deploy
pattern is **Docker container + Caddy + cloudflared `<slug>.hearst.app`** (see
`aigent-*`, `hearst-intelligence-*`, `btc-case-platform-*` on GPU1, and
`docs/gpu1-runtime-existing.md`). `gpu1-backend/` builds and deploys with that
runner; it is a workspace package, not a second repo.

## Status (this pass)

Foundation + first vertical slice, per the strangler plan
(`docs/gpu1-migration-status.md`):

- ✅ Runtime (Fastify), `/health`, `/ready`, `/api/v1/runtime`
- ✅ Supabase access from GPU1 (reuses the prod connection string; **no second DB**)
- ✅ Canonical domain DTOs (`domain/`) — the shared contract for API + frontend client
- ✅ Auth boundary (`auth/` — validates a signed session, never trusts a client role)
- ✅ Dashboard domain end-to-end (`GET /api/v1/dashboard`)
- 🚧 BTC / Mining / Profile / Subscription / Admin — scaffolded, see migration status
- 🚧 v2 event indexer — schema + `NOT_CONFIGURED` status (contract not deployed)

## Commands

```bash
pnpm --filter gpu1-backend dev        # tsx watch
pnpm --filter gpu1-backend build      # tsc
pnpm --filter gpu1-backend test       # vitest
pnpm --filter gpu1-backend typecheck  # tsc --noEmit
```

Never commits secrets. `DATABASE_URL` (same Supabase pooler as Connect prod) and
`SESSION_SIGNING_KEY` come from the GPU1 environment, never from Git.
