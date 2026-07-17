# Prisma migration waves — frontend → hearst-connect-backend

## Where this stands

**Baseline captured 2026-07-17** (mission HC-BTC-026): 137 distinct frontend
files import `@prisma/client`, `PrismaClient`, or `@/lib/db` directly
(excluding tests) — see `scripts/prisma-frontend-baseline.json` for the
exact list. `scripts/prisma-frontend-guard.mjs` fails CI if this count
grows; it does not (and is not meant to) shrink it — that's this document's
job, wave by wave.

The architectural target (see `CLAUDE.md` and
`hearst-connect-backend/docs/migration-from-monorepo.md`) is
`hearst-connect-backend` owning Prisma exclusively. Getting there in one
pass was evaluated and rejected (mission HC-BTC-024/026): 137 files span
auth, 15+ external webhooks (Sumsub/DocuSign/HubSpot/Resend/Typeform),
the cockpit chat, every `/admin/**` surface, and live financial mutations
(`subscribe`/`redeem`). Migrating all of it without per-domain integration
tests would risk breaking production flows that work today, for a
structural goal with no user-facing payoff on its own.

## Wave plan

Each wave is a self-contained mission scope — cartography, migration,
verification, guard-baseline update — not a single sweeping change.

### Wave 1 — Portfolio / Vault / Profile reads
`src/lib/data/portfolio.ts`, `vaults.ts`, `profile-data-source.ts` and the
Server Components that call them directly. Read-only, no financial
mutation — lowest risk, highest value (completes the read-side migration
`/btc`/`/dashboard`/`/mining` already went through).

### Wave 2 — Proof-center / Admin reads
`src/lib/proof-center/*`, `src/lib/data/admin-overview.ts`,
`customer-detail.ts`, and the ~20 `/admin/**` page loaders. Larger surface,
still read-only. Requires `/api/v1/admin/*` routes on the backend (none
exist yet — see `hearst-connect-backend/docs/authorization.md` for the
admin-route pattern to follow when they're added) and a
`role === "admin"` re-assertion on every one, per
`OWNERSHIP_MATRIX.md`'s rule.

### Wave 3 — Webhooks
Sumsub, DocuSign, HubSpot, Resend, Typeform, Outreach inbound/unsubscribe —
15+ `route.ts` handlers that both verify a provider signature AND write to
Prisma. Highest external-integration risk: each requires its own signature
verification test before touching the write path. Likely stays partially
on the frontend long-term (webhook receipt is inherently tied to the
public route the provider calls) even after the backend owns the actual
writes — the frontend route would become a thin signature-verify +
forward-to-backend adapter.

### Wave 4 — Auth / Chat
`src/lib/auth/*`, `src/lib/agents/*`, `src/app/api/cockpit-chat/*`. Auth
is the highest-blast-radius domain in the app — migrating session
resolution off frontend Prisma needs its own dedicated security review,
not a drive-by change alongside other waves.

### Wave 5 — Financial mutations
`src/app/actions/subscribe.ts`, `redeem.ts`,
`src/app/api/rebalancing/execute/route.ts`. Last wave, deliberately: these
are the only paths that move money or execute on-chain transactions.
Requires the backend to first support writes at all (it is 100% read-only
today — see `hearst-connect-backend/docs/data-sources.md`), idempotency
keys, an audit log, and a rollback story none of the read waves need.

## Keeping the two schemas in sync (interim state)

While the frontend remains the canonical schema owner (waves not yet
complete), `scripts/prisma-schema-sync-check.mjs` compares
`prisma/schema.prisma`'s SHA-256 against the backend repo's copy (as a
local sibling checkout) and fails loud on drift. Run it after any schema
change, before pushing to `hearst-connect-backend`. It's advisory-only in
CI (skips cleanly when the backend repo isn't checked out alongside this
one — most CI runners only have one repo).

## Updating the guard baseline

After a wave lands and files stop importing Prisma directly:

```bash
node scripts/prisma-frontend-guard.mjs --update
```

This rewrites `scripts/prisma-frontend-baseline.json` to the new (smaller)
count — the guard from then on fails if anyone regresses past the new,
lower baseline.
