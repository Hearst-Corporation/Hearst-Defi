# ADR-014 — Go-live preflight gate and secret hygiene

**Status**: Accepted
**Date**: 2026-06-12
**Deciders**: Founder (Adrien) + Eng
**Relates to**: `src/lib/env.ts`, `scripts/preflight-prod.mjs`, `docs/roadmap.json`

## Context

A full app review on 2026-06-12 surfaced two related gaps ahead of go-live:

1. **No executable deployment gate.** `src/lib/env.ts` throws at Next.js boot when
   critical env vars are absent, but this check fires only when the server starts — it
   does not run in CI, does not distinguish P0 (hard blockers) from P1 (warnings), and
   gives no actionable output to the operator before a deploy reaches production.

2. **~13 secrets in plain text in `.env.local`.** The dev machine's `.env.local` (git-
   ignored) contained secrets acquired across several development phases, including at
   least one `INNGEST_SIGNING_KEY` value carrying a `signkey-prod-*` prefix. Keeping
   production-grade secrets in a flat dotfile on a workstation is incompatible with the
   institutional posture of the Cayman SPV and with basic secret rotation hygiene.

Neither issue was blocking day-to-day development, but both must be resolved before the
first production deployment is authorised.

## Decision

### 1. Executable preflight gate (`scripts/preflight-prod.mjs`)

A standalone Node script at `scripts/preflight-prod.mjs` becomes the **mandatory gate
before any production deployment**. It is wired as `pnpm preflight` in `package.json`.

The script loads environment variables using a zero-dependency inline parser: `.env.local`
is read first, then `.env`; values already present in `process.env` take precedence over
both files (so CI-injected secrets are never overridden by dotfiles). No `dotenv` package
is required or used. It then applies a two-tier check:

**P0 — hard blockers (exit 1 if missing or placeholder):**
- `DATABASE_URL` — must be a `postgres://` or `postgresql://` URI (not the SQLite dev
  path `file:./prisma/dev.db`)
- `INNGEST_SIGNING_KEY` — must be present; the gate rejects non-production signing keys
  by enforcing the `signkey-prod-` prefix (keys without this prefix exit 1)
- `PERSONA_WEBHOOK_SECRET` — must be present and non-empty
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — both must be present
- Vault on-chain address (`NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS`, with fallback to legacy
  `NEXT_PUBLIC_HEARST_VAULT_ADDRESS`) — must be a format-valid `0x` address (regex,
  case-insensitive, 40 hex characters); the zero address is rejected; EIP-55 checksum
  validation is deferred to the chain client layer

If any P0 check fails, the script prints a labelled error and exits with code 1,
preventing the deploy pipeline from proceeding.

**P1 — non-blocking warnings (logged to stdout, no exit code change):**
- `RESEND_API_KEY` — email distributions will silently fail without it
- `OPENAI_API_KEY` — all 4 agents + cockpit chat will be unavailable
- `DOCUSIGN_WEBHOOK_SECRET` — DocuSign round-trip verification disabled
- `ATTESTATION_ALLOWED_SIGNERS` — attestation guard falls back to permissive mode
- `AUTH_TOTP_KEY` — TOTP second factor for admin login will be unavailable

This script **complements** (does not replace) `src/lib/env.ts`: `env.ts` continues to
throw at server boot for the same critical vars, acting as a last-resort runtime guard.
The preflight script is the pre-deploy, CI-runnable, human-readable layer.

### 2. Secret hygiene — rotation before go-live

The 2026-06-12 review identified secrets that must be rotated before any production
traffic is routed to the application:

- Any `INNGEST_SIGNING_KEY` value that was used on the development machine must be
  invalidated and a fresh key issued from the Inngest dashboard.
- All other secrets present in `.env.local` that carry production-tier values
  (Supabase service-role, Resend, OpenAI, Upstash, Privy, DocuSign) must be rotated
  via their respective provider dashboards.

**No secret values are recorded in this ADR or in any source-controlled file.**

After rotation, secrets must be injected via the deployment platform's secret manager
(Vercel Environment Variables, Railway secrets, or equivalent) — never committed to the
repository and never stored in `.env.local` on production infrastructure.

Status of rotation as of this ADR: **PENDING** (external action required on provider
dashboards before go-live is authorised).

## Consequences

### Positive
- **Deterministic go/no-go signal**: the preflight script gives operators and CI a
  single exit code to gate on, eliminating "works in dev, breaks in prod because an env
  var was missing" incidents.
- **Separation of concerns**: P0/P1 tiers let the team distinguish launch blockers from
  nice-to-have warnings without changing `src/lib/env.ts`.
- **Audit trail**: this ADR documents the 2026-06-12 finding and the rotation
  requirement, satisfying the institutional due-diligence posture of the Cayman SPV.

### Negative / risks
- **Rotation is a manual external action**: until provider dashboards are updated and
  new values are injected into the deployment platform, go-live is blocked. There is no
  automated enforcement of rotation completion beyond the preflight P0 check on key
  presence.
- **Preflight script must be maintained** in sync with `src/lib/env.ts` as new required
  vars are added. Risk of drift: if a new P0 var is added to `env.ts` but not to the
  preflight script, the gate is silently incomplete.

## Non-decisions (out of scope)
- **No secret manager SDK is introduced** by this ADR. Vault (HashiCorp) or AWS
  Secrets Manager integration is a V2 concern; the immediate step is moving secrets
  off dotfiles and into the deployment platform's built-in secret store.
- **No changes to `src/lib/env.ts`**: its throw-on-missing behaviour is preserved as-is.
- **No changes to CI workflow files**: wiring `pnpm preflight` into the CI pipeline is
  a follow-up task tracked on the roadmap.

## References
- `src/lib/env.ts` — runtime boot guard (complemented, not replaced, by this ADR).
- `scripts/preflight-prod.mjs` — the executable gate introduced by this ADR.
- `docs/roadmap.json` — go-live preflight item.
- ADR-006 — mainnet deploy gate (Spearbit audit requirement, orthogonal but related).
