# Network Request Guardrails

Non-UI performance guardrail that catches **duplicate client-side network calls**
regressing back into the cockpit. It is a read-only observer — it changes no
application code, UI, design system, router, guard, HITL, or chat behaviour.

## Problem observed

Loading `/portfolio` was fast on the server but noisy on the client:

| Surface | Measured | Verdict |
| --- | --- | --- |
| TTFB | ~89 ms | fine |
| FCP | ~132 ms | fine |
| DOM nodes | ~466 | fine |
| Long tasks | 0 | fine |
| `backdrop-filter` | none active | fine |
| **`/api/chat-nav`** | **7 calls on one initial load** | **regression** |
| **`/api/admin/review-mode`** | **fired on `/portfolio`** (a non-admin route) | **regression** |

SSR/FCP were never the bottleneck — the cost was purely client-side network
churn. `/api/chat-nav` is the chat-nav bridge poll
([`src/components/chat/chat-nav-bridge.tsx`](../../src/components/chat/chat-nav-bridge.tsx));
`/api/admin/review-mode` is the lazy admin-role probe
([`src/components/chat/chat-presets.tsx`](../../src/components/chat/chat-presets.tsx),
[`src/components/admin/admin-chat-controls.tsx`](../../src/components/admin/admin-chat-controls.tsx)).

The **application fix is owned by another agent/session.** This guardrail only
measures and locks in the target so the regression can't silently return.

## Endpoints watched

| Endpoint | Rule on `/portfolio` (non-admin) |
| --- | --- |
| `/api/chat-nav` | at most **1** call on initial load |
| `/api/admin/review-mode` | **0** calls (only allowed on explicitly admin/review routes) |

## How to run

The script needs a running server (the local dev server is fine) and, for
authenticated routes, a seeded test user.

```bash
# 1. start the app (separate terminal)
pnpm dev                 # http://localhost:4105

# 2. (once) seed the login user the script signs in with
pnpm seed:test           # test@hearst.local / TestPassword123!

# 3. run the guardrail
pnpm qa:perf-network
```

Direct invocation / overrides:

```bash
BASE_URL=http://localhost:4105 node scripts/perf/qa-network-guardrails.mjs
```

Useful env overrides:

| Var | Default | Meaning |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:4105` | server to probe |
| `QA_ROUTE` | `/portfolio` | route to measure |
| `QA_EMAIL` / `QA_PASSWORD` | seeded test user | form login credentials |
| `QA_SETTLE_MS` | `4000` | extra wait after load to catch polling bursts |
| `QA_MAX_CHAT_NAV` | `1` | max allowed `/api/chat-nav` calls |
| `QA_MAX_REVIEW_MODE` | `0` | max allowed `/api/admin/review-mode` calls on a non-admin route |
| `QA_REQUIRE_LONGTASKS_0` | unset | set to `1` to make long tasks a hard failure |

## Thresholds

- `chat-nav calls <= 1` — **hard** (exit 1 on breach)
- `admin review-mode calls == 0` on non-admin routes — **hard** (exit 1 on breach)
- `long tasks == 0` — **soft** by default (reported as WARN); becomes hard with
  `QA_REQUIRE_LONGTASKS_0=1`. If the runtime doesn't support the `longtask`
  PerformanceObserver entry, it is reported as `unavailable`, never as a pass.
- TTFB / FCP / DOMContentLoaded / DOM nodes are reported as **INFO** only — they
  are environment-sensitive and intentionally not gated, matching the repo's
  existing stress-script convention of measuring without flaky CI thresholds.

## Reading the output

```txt
PERF NETWORK QA — /portfolio
chat-nav calls: 1 (max 1) PASS
admin review-mode calls: 0 (max 0 on non-admin /portfolio) PASS
long tasks: 0 WARN/PASS
dom nodes: 466 INFO
fcp: 132ms INFO
ttfb: 89ms INFO
domContentLoaded: 700ms INFO

per-endpoint API call counts:
    1  /api/chat-nav

OK — all network guardrails passed
```

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | all hard guardrails passed |
| `1` | a hard guardrail was breached (too many / forbidden calls) |
| `2` | **could not run** — server down, login blocked, or chromium missing. This is **not** a pass; the script never fabricates a result. |

If the application fix is not merged yet, expect a **FAIL** (`chat-nav calls: 7`,
or `admin review-mode calls: 1`). That is the guardrail working as intended — it
surfaces the regression rather than hiding it.

## What this guardrail does NOT do

- It does **not** modify `/api/chat-nav`, `/api/admin/review-mode`, or any
  client component — the application fix is owned elsewhere.
- It does **not** touch UI/UX, the design system, `/admin/agentic`, the portfolio
  visuals, the router/guard/HITL/chat behaviour, API contracts, or Prisma/schema.
- It does **not** assert FCP/DOMContentLoaded thresholds (too environment-flaky
  for CI); those are informational.
- It is not a load test — for HTTP burst/rate-limit stress see
  [`scripts/stress/`](../../scripts/stress/).
