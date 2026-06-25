# Agentic Control Center — v0 (read-only visibility)

**Route:** `/admin/agentic` · **Status:** read-only · **Owner module:** `src/lib/agentic/control-center/`

## Why this exists

The agentic chain — agents, swarms, prompts, tools, guards, human gates — already
lives in code, but it was invisible from the product. There was no single place
where an admin could answer:

- which agents / logics exist;
- where their prompts live;
- which tools they can call;
- which actions are forbidden;
- what is active vs shadow;
- which guards apply;
- which human gates protect every write.

The Agentic Control Center makes that chain **visible**, in one read-only page.

## What it shows

The page (`src/app/admin/agentic/page.tsx`) renders seven sections, each backed
by a static, typed module:

| Section | Module | Accessor |
| --- | --- | --- |
| System status (safety) | `safety-summary.ts` | `getSafetySummary()` |
| Router | `router-status.ts` | `getRouterStatusSummary()` |
| Agents & logic inventory | `inventory.ts` | `getAgenticInventory()` |
| Tool boundary | `tool-boundary-summary.ts` | `getToolBoundarySummary()` |
| Human gates | `gates.ts` | `getHumanGateInventory()` |
| Prompt map | `prompt-map.ts` | `getPromptMap()` |
| Next steps | inline | — |

Each inventory item points at its **real source-of-truth path(s)**, and carries
its `type`, `status`, `writesAllowed`, `humanGateRequired`, `riskLevel`, and notes.

## What it does NOT do — read-only guarantee

This feature is **read-only by construction**:

- No DB query, no Prisma call.
- No LLM call.
- No tool execution, no confirmation token creation, no write.
- No filesystem scan at runtime — the inventory is a static, client-safe constant.
- The page is `export const dynamic = "force-static"`.

It describes the agentic chain; it never drives it.

## How to add an agent to the registry

1. Open `src/lib/agentic/control-center/inventory.ts`.
2. Append an `AgenticInventoryItem` with accurate `paths` and flags:
   ```ts
   {
     id: "my-agent",
     name: "My Agent",
     domain: "scenario",
     paths: ["src/lib/agents/my-agent.ts"],
     type: "batch-agent",
     status: "active",
     writesAllowed: false,
     humanGateRequired: false,
     riskLevel: "low",
     notes: "What it does, structured-output only, compliance posture.",
   }
   ```
3. If the agent can write, add a matching **human gate** (see below) and a prompt
   map entry pointing at its prompt.
4. The inventory test (`__tests__/control-center.test.ts`) asserts core agents
   are present and ids are unique — keep it green.

## How to add a gate

1. Open `src/lib/agentic/control-center/gates.ts`.
2. Append a `HumanGate`. **Every critical gate must be**
   `autonomousAllowed: false`, `requiresAdmin: true`, `requiresConfirmation: true`
   — the test enforces this invariant.
3. Point `paths` at the server action / policy that enforces the gate.

## Limits of v0

- Static, not live: status reflects code wiring, not real-time run activity.
- No per-turn router trace, no audit timeline, no run counts.
- Prompt **bodies** are not rendered (paths + summaries only), to avoid exposing
  the steering surface in the UI.
- Manual registry: adding an agent in code does not auto-register it here.

## Next steps

- Wire live run signals (`LlmRun` + `AdminToolRun` counts) into each card.
- Surface the active vs shadow router decision per recent turn (read-only trace),
  after the router/guard stabilization lands.
- Add a per-gate "last invoked / last confirmed" timeline from the audit log.

## Non-goals

No crew runtime, no CrewAI, no tool execution, no write, no live DB traces, no
prompt editing, no deploy console.
