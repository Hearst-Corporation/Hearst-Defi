# GPU1 auth contract — Connect → GPU1

Service-to-service + user identity. Connect's trusted server boundary mints a
short-lived signed token from the REAL DB session; GPU1 validates it and derives
the role from the signed payload. **GPU1 never trusts a role sent by the browser.**

## Token format

`<payloadB64url>.<sigB64url>` where:
- `payloadB64url` = base64url of `{ userId: string, role: "investor"|"admin", exp: number }`
- `sig` = `HMAC-SHA256(payloadB64url, GPU1_SESSION_SIGNING_KEY)`, base64url

Sent as `Authorization: Bearer <token>`. TTL = **120 s** (minted per request, not stored).

## Issuer (Connect, server-only)

`src/lib/gpu1-client/mint-token.ts` — `mintGpu1Token(userId, role)`. Runs ONLY on
Connect's server boundary (`server-only`). Reads `GPU1_SESSION_SIGNING_KEY` from
server env; the secret never reaches a client bundle. The role comes from the
DB-backed session (`getSession()`), never from a request field.

`src/lib/gpu1-client/server.ts` — `getDashboardViaGpu1()` resolves the session,
mints the token, calls GPU1 with it. No session → throws (no fallback).

## Validator (GPU1)

`gpu1-backend/src/auth/session.ts` — `verifySession(authorization, nowMs)`:
- constant-time HMAC comparison (`timingSafeEqual`)
- rejects: `missing` / `malformed` / `bad_signature` / `expired` / `not_configured`
- fail-closed: no `GPU1_SESSION_SIGNING_KEY` → `not_configured` (503), never open

## Shared secret

`GPU1_SESSION_SIGNING_KEY` (Connect env) === `SESSION_SIGNING_KEY` (GPU1 `.env`).
≥16 chars. Rotation = update both sides; in-flight 120 s tokens expire naturally.
Never committed.

## Proven end-to-end (live, PROMPT 220/221)

Against the running GPU1 service:
- valid token → **200 + DTO**
- **tampered** signature (forged `role:admin`, wrong key) → **401**
- expired token → 401 · missing token → 401 · no signing key → 503

→ A browser cannot forge an admin role: without the shared HMAC secret, any token
it mints is rejected.

## CORS

`gpu1-backend` allows only `CORS_ORIGINS` (default `https://connect.hearst.app,
http://localhost:4105`), `Access-Control-Allow-Credentials: true`, explicit
methods/headers. Never `*` with credentials. `/health` public; `/ready`,
`/api/v1/runtime` expose non-sensitive fields only; business + admin endpoints
require a valid token.
