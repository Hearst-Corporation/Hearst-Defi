// src/lib/backend/browser-client.ts
//
// Client Component entry point. Deliberately NOT implemented with a direct
// browser→backend call today: no screen needs one yet (every current
// consumer is a Server Component reading via server-client.ts), and a
// browser call would need its own session-token minting endpoint
// (`POST /api/backend-token` on Connect, not yet built) rather than reusing
// mintBackendToken (server-only, signs with a secret that must never reach
// the client bundle).
//
// If a future Client Component needs live backend data (e.g. a polling
// widget), add a thin Route Handler on Connect that mints a token
// server-side and either proxies the call or hands the browser a short-lived
// token — never export mintBackendToken or BACKEND_SESSION_SIGNING_KEY here.

export {};
