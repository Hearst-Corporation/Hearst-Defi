# Prisma + git worktrees — provider isolation

Infra guard that stops one worktree from silently breaking another worktree's
running dev server by regenerating the **shared** Prisma client with the wrong
database provider.

## The problem

The app supports two providers, swapped at build time by
[`scripts/prisma-provider.mjs`](../../scripts/prisma-provider.mjs):

- **postgresql** — local dev (default, via `.env.local`), CI, Vercel prod.
- **sqlite** — the test suite (`pretest` regenerates a sqlite client + `dev.db`).

The provider is **baked into the generated Prisma client** (sqlite vs pg adapter).

## The cause — a shared generated client

pnpm content-addresses dependencies: every git worktree with the same dependency
closure symlinks `node_modules/@prisma/client` into the **same**
`.pnpm/@prisma+client@<hash>/…` store directory. `prisma generate` writes the
generated runtime **into that shared directory**. So:

```
worktree A:  pnpm dev            → generates POSTGRES client, server runs on :4105
worktree B:  pnpm test           → pretest runs `PRISMA_PROVIDER=sqlite prisma generate`
                                   → overwrites the SHARED client with SQLITE
worktree A's live server now throws:
  "Driver Adapter @prisma/adapter-pg ... is not compatible with the provider `sqlite`"
```

This broke the live dev server **twice** during the performance lots.

## The fix — a safety guard

[`scripts/assert-prisma-provider-safe.mjs`](../../scripts/assert-prisma-provider-safe.mjs)
runs **before** any sqlite generate. Generating the postgres client is always
safe (it can't break a postgres consumer); the danger is only a **sqlite**
generate while a postgres dev server is live. The guard:

- **postgresql** → always allowed.
- **sqlite + no dev server listening** → allowed.
- **sqlite + a dev server listening on the dev port (4105)** → **REFUSED** (exit 1)
  with a clear message — unless an isolation override is set.

It is wired into `pretest`, so `pnpm test` fails fast (before any clobber) when a
dev server is up, instead of silently corrupting it.

```
[prisma-provider] a local dev server is listening on :4105.
[prisma-provider] REFUSED (sqlite) — refusing sqlite generate while a local dev
  server appears active — it would overwrite the shared Prisma client and break
  that (postgres) server.
[prisma-provider] use PRISMA_PROVIDER=postgresql for dev, or stop the dev server
  before running sqlite tests, or run them isolated with PRISMA_SQLITE_ISOLATED=1.
```

## Safe commands

| Goal | Command | Notes |
| --- | --- | --- |
| Run the app | `pnpm dev` | postgres (from `.env.local`); always safe |
| Production build | `pnpm build` | postgres; always safe |
| Run tests (no dev server up) | `pnpm test` | guard passes, sqlite generate proceeds |
| Run tests while a dev server runs | **stop the dev server first**, then `pnpm test` | the guard refuses otherwise |
| Run tests in a known-isolated env | `pnpm test:sqlite:isolated` | sets `PRISMA_SQLITE_ISOLATED=1`; CI sets this implicitly via `CI` |
| Regenerate the postgres client | `PRISMA_PROVIDER=postgresql pnpm db:generate` | restores a clobbered client |

## Forbidden / unsafe

- ❌ Running `pnpm test` (or any `PRISMA_PROVIDER=sqlite prisma generate`) **while a
  postgres dev server is running in any worktree** — the guard now blocks this.
- ❌ Setting `PRISMA_SQLITE_ISOLATED=1` to silence the guard when a real postgres
  dev server **is** live — that's exactly the corruption the guard prevents. Only
  use the override in CI or a genuinely isolated `node_modules`.

## If the client is already broken

Symptom: a running dev server throws
`@prisma/adapter-pg ... not compatible with the provider sqlite` (or vice-versa).

Restore it (from the worktree whose server you want working):

```bash
PRISMA_PROVIDER=postgresql node scripts/prisma-provider.mjs   # fix schema.prisma line
PRISMA_PROVIDER=postgresql pnpm exec prisma generate          # regenerate shared client
rm -rf .next/dev .next/cache                                   # drop the stale compiled chunk
# restart the dev server
```

Confirm: `activeProvider==="postgresql"` in the generated client, and
`prisma/schema.prisma` shows `provider = "postgresql"` in the `datasource` block.

## Rule for agents / worktrees

One agent = one worktree, but **all worktrees share one Prisma client**. Treat a
sqlite generate as a machine-global side effect:

1. Never run `pnpm test` while another worktree's postgres dev server is live —
   the guard will refuse; that refusal is correct, not a bug.
2. Develop/build on **postgres** (the default). Only the test suite uses sqlite,
   and only when no postgres server is up.
3. After any sqlite test run, `posttest` restores the postgres client. If a run
   was interrupted, restore it manually (see above) before relying on a server.
4. Long term, the structural fix is a per-worktree generated client output (so
   sqlite and postgres clients never collide) — see "Next lot".
