# GPU1 Back-End Architecture (target)

**PROMPT 219 — pivot GPU1.** `gpu1-backend/` is the physically separate business
back-end that Hearst Connect's frontend consumes. It owns every business read and
write. The frontend never touches Prisma / Supabase / RPC / providers directly —
it goes through `src/lib/gpu1-client` over HTTP.

## Data-flow diagram (from `gpu1-backend/README.md`)

```
Sources externes / smart contract v2 (futur)
        ↓  indexers/  workers/
gpu1-backend (this service)
        ↓  persistence/  (Prisma)
Supabase PostgreSQL  ← SAME canonical prod DB, not duplicated
        ↓  api/  (Fastify + Zod DTOs)
Frontend Connect  (src/lib/gpu1-client — the only business data source)
```

The key invariant: **Supabase is the same canonical prod DB Connect already uses.**
GPU1 does not duplicate it — it becomes its only application-level owner. GPU1
reuses Connect's generated Prisma client (via the workspace `node_modules`) so the
schema stays single-sourced in `prisma/schema.prisma`.

## Stack

- **Runtime:** Node 22.
- **HTTP server:** Fastify.
- **Validation:** Zod — DTOs are validated at the boundary; env is validated at
  boot (`gpu1-backend/src/config/env.ts`, fail-loud, never defaults a secret).
- **Persistence:** Prisma against the canonical Supabase Postgres pooler
  (`DATABASE_URL` from the GPU1 environment, never committed).
- **Deploy:** Docker container + Caddy + cloudflared, published at
  `<slug>.hearst.app`, built and shipped by the GPU1 GitHub Actions runner scoped
  to this repo (`Hearst-Corporation-Hearst-Defi.gpu1-defi`). This is the canonical
  per-app GPU1 deploy pattern already used by `aigent-*`,
  `hearst-intelligence-*`, `btc-case-platform-*`.

`gpu1-backend/` is a **workspace package in this monorepo**, not a second repo.
Commands (from `gpu1-backend/README.md`):

```bash
pnpm --filter gpu1-backend dev        # tsx watch
pnpm --filter gpu1-backend build      # tsc
pnpm --filter gpu1-backend test       # vitest
pnpm --filter gpu1-backend typecheck  # tsc --noEmit
```

## Folder structure (target)

```
gpu1-backend/
  src/
    config/        env.ts — Zod-validated boot config (PORT 3900, DATABASE_URL,
                   SESSION_SIGNING_KEY, CORS_ORIGINS, DYNAVAULT_ADDRESS, CHAIN_ID)
    domain/        index.ts — CANONICAL DTOs (the shared contract; no Prisma types,
                   no ABI tuples, no bare BigInt cross this boundary — everything is
                   a string/number the browser renders directly)
    persistence/   prisma.ts — the ONE Prisma client (same Supabase pooler) + pingDb()
    api/           Fastify routes → Zod DTOs (per-domain: dashboard, btc, mining,
                   profile, subscription, admin, runtime, health)
    application/   application services (one per domain; orchestrate repositories +
                   derivation, return domain DTOs)
    auth/          service-to-service session validation (never trusts a client role)
    indexers/      v2 on-chain event ingestion (schema present; NOT_CONFIGURED until
                   the contract is deployed)
    workers/       jobs / crons (Inngest targets migrated here over time)
```

> Present in the repo this pass: `config/env.ts`, `domain/index.ts`,
> `persistence/prisma.ts`. The `api/`, `application/`, `auth/`, `indexers/`,
> `workers/` layers are being filled in per the milestones in
> `docs/gpu1-migration-status.md`.

## The request chain

Every business read/write follows the same chain, so a value's provenance and
honesty envelope survive from the DB to the browser:

```
Frontend (src/lib/gpu1-client)
   → HTTP (Fastify Route, Zod-validated I/O)
      → Application service (per-domain orchestration + derivation)
         → Domain model (Resolved<T> / DTOs — the contract in domain/)
            → Repository (persistence/)
               → Prisma
                  → Supabase Postgres (same canonical prod DB)
```

- **Route** — Fastify handler; validates input and serializes the DTO. No business
  logic beyond shaping the response.
- **Application service** — orchestrates repositories, applies derivation, and
  wraps every value in the domain's `Resolved<T>` envelope
  (`status`/`value`/`provenance`/`freshness`). Computes values like
  `availableCapacity` **here**, never in the client.
- **Domain** — `gpu1-backend/src/domain/index.ts`. Transport-independent types;
  the single source of truth re-exported by the frontend client.
- **Repository → Prisma → Supabase** — data access only; no Prisma scalar (Date,
  Decimal, BigInt) leaks past the repository boundary.

## Auth — service-to-service

The frontend never asserts a trusted role. The model:

1. **Connect mints a signed session token** for the authenticated request (it
   already owns the user session / login flow).
2. Connect forwards that token to GPU1 on every business call (via
   `gpu1-client` headers, e.g. `Authorization`).
3. **GPU1 validates the token** with `SESSION_SIGNING_KEY` (HMAC, shared secret
   from the GPU1 environment) and **derives the role itself** from the validated
   claims.
4. GPU1 **never trusts a role the frontend puts in the body or headers** — only
   the role it derives from the validated signature counts. A missing/invalid
   token fails closed (401/403) before any DB access.

This keeps authorization on the server that owns the data, matching Connect's own
fail-closed posture for mutating and admin routes.

## Frontend client contract (`src/lib/gpu1-client`)

- One fetch wrapper, `gpu1Fetch<T>(path, opts)` — base URL from
  `NEXT_PUBLIC_GPU1_API_URL` (dev fallback `http://localhost:3900`), 10s timeout
  (AbortController), a `crypto.randomUUID()` request ID per call, JSON parse,
  error mapping to `GPU1Error`, and one controlled retry on 5xx/timeout (never on
  4xx).
- **No fixture fallback, no RPC fallback, no legacy `src/lib/data` fallback.** A
  GPU1 failure surfaces as a `GPU1Error` so the UI renders an honest
  error/unavailable state.
- Pure transport: zero viem / prisma / chain imports. Usable from Server
  Components and Client Components alike.
- Domain types are re-exported from `gpu1-backend/src/domain` (type-only) so the
  API and the client can never drift.

## Related docs

- `docs/gpu1-migration-status.md` — strangler plan M1→M10 + rollback posture.
- `docs/gpu1-migration-inventory.md` — per-file inventory of what migrates where.
- `gpu1-backend/README.md` — service-level status and commands.
