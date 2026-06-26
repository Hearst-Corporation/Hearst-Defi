# Agentic read-only API

Admin-gated, **read-only / simulation-only** HTTP surface over the agentic
foundation (`src/lib/agentic/swarm`). It exposes the typed registry and runs the
deterministic swarm simulation. It performs **no DB write, no external tool call,
no real execution**, and stores **no prompt / user text / secret**.

See also: [`BACKEND_AGENTIC_FOUNDATION.md`](./BACKEND_AGENTIC_FOUNDATION.md).

## Endpoints

### `GET /api/admin/agentic/registry`

Returns a deterministic snapshot of the agentic foundation. Admin-gated
(`requireAdmin` → 401/403). Served `Cache-Control: no-store`. No DB query.

Response `200`:

```jsonc
{
  "snapshot": {
    "agents":  [{ "id": "...", "name": "...", "domain": "..." }],
    "crews":   [{ "id": "...", "label": "...", "trigger": "...", "mode": "...",
                  "risk": "...", "stepCount": 5, "forbiddenActions": ["..."] }],
    "swarms":  [{ "id": "platform_reporting_swarm", "label": "...",
                  "mode": "simulation", "coordination": "sequential",
                  "crewIds": ["reporting_crew_briefing"], "forbiddenActions": ["..."] }],
    "actions": [{ "id": "deploy_product", "label": "...", "tier": "forbidden_autonomous",
                  "status": "blocked", "autonomousAllowed": false,
                  "humanGateRequired": true, "confirmationRequired": true }],
    "safety": {
      "allowedSwarmModes": ["simulation", "dry_run", "gated"],
      "disallowedSwarmModes": ["autonomous_write"],
      "forbiddenAutonomousActions": ["deploy_product", "mark_vault_live", "..."],
      "simulationOnly": true,
      "noExternalTools": true,
      "noDbWrites": true,
      "noPromptOrUserTextStored": true
    }
  },
  "sideEffects": false
}
```

### `POST /api/admin/agentic/simulate`

Runs `simulateSwarm(swarmId)` (and `evaluateActionReadiness(actionId, context)`
when `actionId` is supplied). Admin-gated; body-size + rate-limited. Served
`no-store`. **Simulation only** — no real execution, no HITL token generated.

Request body (allowlisted; unknown fields ignored):

```ts
{
  swarmId: string;            // required
  actionId?: string;          // optional — evaluates this action's readiness
  context?: {
    hasHumanConfirmationToken?: boolean; // simulation flag only; not a real token
  };
}
```

Response `200`:

```jsonc
{
  "swarm": { "id": "outreach_governed_swarm", "label": "...", "mode": "gated" },
  "steps": [{ "crewId": "...", "label": "...", "mode": "...", "executable": false,
              "blockedActions": ["..."], "requiredGates": ["..."] }],
  "blockedActions": ["send", "outreach_trigger_send_run", "..."],
  "requiredGates": ["step_await_human_gate"],
  "requiredConfirmations": ["step_await_human_gate"],
  "safetyNotes": ["..."],
  "audit": [{ "kind": "swarm_simulated", "swarmId": "...", "actionPolicy": "gated",
              "executionMode": "gated", "blocked": false, "gateRequired": true,
              "reasonCode": "swarm_gated" }],
  "readiness": null,          // or an ActionReadinessEvaluation when actionId is given
  "sideEffects": false
}
```

Errors:

| Status | When |
| --- | --- |
| `400` | invalid JSON, missing/invalid `swarmId`, bad `actionId`/`context` type |
| `401` | not authenticated |
| `403` | authenticated but not admin |
| `404` | unknown swarm (`kind: "unknown_swarm"`, `sideEffects: false`) |
| `429` | rate-limited |
| `500` | internal — generic message, never a stack trace or secret |

## Safety guarantees (enforced + tested)

- **Admin-gated + per-admin rate-limited.** Every endpoint runs `requireAdmin`
  (→ 401/403) and is rate-limited per admin (60/min) — reads included — so a
  leaked admin session or accidental hammering returns `429`, not unbounded load.
- **`sideEffects: false`** on every success and on a typed simulation error.
- **No DB write, no external tool call, no real execution, no network** during a
  simulation (the underlying functions are pure).
- **Forbidden actions stay blocked even with `hasHumanConfirmationToken: true`.**
- **`confirmed_write` stays `requires_human_confirmation`** unless an explicit
  simulation token is passed (then `allow`, still never autonomous).
- **Unknown write-like actions are blocked** (fail-safe classification).
- **Unknown swarm → `404`**, never a fallback execution.
- The simulation token is a **simulation flag only** — the API generates no real
  HITL token and grants no real capability.
- No prompt / user text / secret is accepted, echoed, or logged.

## Relation to the UI

`/admin/agentic` (the Control Tower) may later consume these endpoints read-only
to render swarms / run simulations — that is a separate **UI** lot. This surface
adds no UI and no visual change.

## What stays forbidden here

- ❌ No mutation, no write, no migration.
- ❌ No external tool / send / deploy / on-chain.
- ❌ No prompt / user-text / secret storage or logging.
- ❌ No new dependency, no CrewAI.
