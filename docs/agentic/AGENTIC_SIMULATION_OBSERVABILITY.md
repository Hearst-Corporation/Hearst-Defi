# Agentic simulation observability

Optional, **opt-in**, **append-only**, **metadata-only** audit of agentic swarm
simulations. It records WHICH swarm/action was simulated and the SHAPE of the
outcome — never a prompt, user message, raw payload, token, cookie, header, or
stack trace. It uses **no Prisma / no migration / no durable DB write** (Redis
capped list + in-memory fallback), and a store failure never affects a
simulation.

See also: [`AGENTIC_READONLY_API.md`](./AGENTIC_READONLY_API.md),
[`BACKEND_AGENTIC_FOUNDATION.md`](./BACKEND_AGENTIC_FOUNDATION.md).

## What is recorded (metadata only)

`AgenticSimulationTrace`:

```ts
{
  id: string;                 // "sim:<uuid>"
  createdAt: string;          // ISO timestamp
  kind: "agentic_simulation";
  swarmId: string;
  swarmMode: "simulation" | "dry_run" | "gated";
  actionId?: string;
  readinessOutcome?: "allow" | "gated" | "requires_human_confirmation" | "blocked";
  blockedCount: number;
  gateCount: number;
  confirmationCount: number;
  auditReasonCodes: string[]; // machine codes, e.g. "swarm_gated", "crew_read_only"
  sideEffects: false;
  metadataOnly: true;
}
```

## What is NEVER recorded

Prompts · user message text · raw request body · raw `context` · HITL tokens ·
cookies · sensitive headers · stack traces · secrets. The trace builder copies
**only** the allowlisted metadata fields, so a caller cannot smuggle extra data
into a trace (unit-tested).

## Opt-in (POST /api/admin/agentic/simulate)

Recording is OFF by default. The business simulation has **no side effects**;
recording a trace is a *technical* side effect gated behind an explicit flag:

```ts
POST /api/admin/agentic/simulate
{
  "swarmId": "vault_governance_swarm",
  "actionId": "deploy_product",
  "context": { "hasHumanConfirmationToken": true },
  "observability": { "record": true }   // ← opt-in; omit/false → nothing recorded
}
```

Response adds an `observability` block; the safety guarantees are unchanged:

```jsonc
{
  "swarm": { "id": "...", "mode": "dry_run" },
  "readiness": { "decision": "blocked", "reasonCode": "forbidden_autonomous" },
  "sideEffects": false,          // business simulation — unchanged guarantee
  "businessSideEffects": false,  // explicit: the simulation mutates nothing
  "observability": {
    "requested": true,
    "recorded": true,
    "storage": "redis"           // or "memory_fallback"
    // "reason": "disabled" | "store_error"  when recorded:false
  }
}
```

Behaviour:
- `observability.record !== true` → nothing recorded (`requested:false`).
- unknown swarm → `404` **before** any record (no trace written).
- `AGENTIC_SIMULATION_OBSERVABILITY=0` → `recorded:false, reason:"disabled"`.
- store error → `recorded:false, reason:"store_error"`; the simulation still
  returns `200` with its full result.

## Reading (GET /api/admin/agentic/simulations)

Admin-gated, `no-store`, metadata-only:

```
GET /api/admin/agentic/simulations?limit=50
→ { "traces": [AgenticSimulationTrace...], "count": N, "metadataOnly": true }
```

`limit` is clamped to `[1, 200]`. The store is small + short-lived; an empty
store returns an empty list.

## Aggregates (GET /api/admin/agentic/simulations/aggregates)

Admin-gated, `no-store`, **metadata-only** roll-up over the recorded traces. It
reads the same Redis-capped + in-memory store (no DB, no mutation) and aggregates
in memory. It emits **no raw trace body** (no `id`/`createdAt`/payload) — only
counts and machine codes.

```
GET /api/admin/agentic/simulations/aggregates?limit=200&window=24h
```

Query params:

| Param | Default | Meaning |
| --- | --- | --- |
| `limit` | `200` | traces to read, clamped to `[1, 200]` |
| `window` | `all` | `1h` / `24h` / `7d` / `all` — filters by `createdAt` |

Response `200`:

```jsonc
{
  "available": true,
  "aggregates": {
    "window": { "requested": "24h", "from": "...", "to": "...", "traceCount": 12 },
    "totals": { "simulations": 12, "blocked": 47, "gates": 3, "confirmations": 3,
                "recordedWithReadiness": 8 },
    "bySwarm": [{ "swarmId": "vault_governance_swarm", "count": 4,
                  "blockedCount": 20, "gateCount": 0, "confirmationCount": 0 }],
    "byMode": [{ "mode": "dry_run", "count": 4 }],
    "byReadinessOutcome": [{ "outcome": "blocked", "count": 4 }],
    "topReasonCodes": [{ "reasonCode": "crew_read_only", "count": 10 }],
    "metadataOnly": true
  }
}
```

Group-by rows are sorted by `count` desc then key asc (deterministic);
`topReasonCodes` is capped (top 10). Errors:

| Status | When |
| --- | --- |
| `400` | invalid `limit` (non-positive) or `window` (not 1h/24h/7d/all) |
| `401` / `403` | not authenticated / not admin |

If the store is unavailable the route returns a **safe** `200` with
`{ available: false, reason: "store_unavailable", aggregates: <empty> }` — never
a stack trace or secret. No `500` path leaks internals.

## Storage / TTL / cap

- Backend: Redis capped list key `agentic:simulation:traces` (distinct from the
  router store), trimmed to **200** entries, **7-day** TTL; mirrored to an
  in-memory buffer for single-instance runtimes + tests.
- **No Prisma, no migration, no durable DB write.** If Redis is absent, traces
  go to the in-memory buffer (`storage: "memory_fallback"`, lost on cold start).

## Safety guarantees (enforced + tested)

- Append-only; metadata-only; no prompt/user text/payload/secret stored.
- Opt-in; default records nothing — the read-only API contract is preserved.
- Best-effort: a store failure returns `recorded:false` and never throws into,
  blocks, or changes the simulation result.
- No business mutation, no external tool, no real execution. `forbidden` stays
  blocked and `confirmed_write` stays gated in the recorded `readinessOutcome`.

## How to disable

Set `AGENTIC_SIMULATION_OBSERVABILITY=0`. Every record call then returns
`{ recorded: false, reason: "disabled" }` and writes nothing. (Reading still
works and simply returns whatever — if anything — is already stored.)

## Relation to the UI

None added. A future Control Tower UI lot may read
`/api/admin/agentic/simulations` to show a simulation history — separate, UI-scoped.
