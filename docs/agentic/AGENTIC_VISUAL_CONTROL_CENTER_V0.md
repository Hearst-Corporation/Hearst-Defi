# Agentic Visual Control Center v0

`/admin/agentic` is now a **visual console**, not a documentation page. The
principle: *show the system before explaining it.*

- **Layer 1 — Live System Map**: the agentic system rendered as layered clusters
  of connected nodes (router, guards, HITL gates, tool boundary, crews/agents,
  observability, tool tiers), with live status / mode / risk badges, metrics, and
  the wiring between them.
- **Layer 2 — Detail Inspector + panels**: a per-layer rollup, read-only jump-links,
  and the existing detailed panels (observability, quality review, tool boundary,
  reporting crew, gates, prompts, inventory) reorganized below the map.

Everything stays **read-only**. No tool is executed, no write is performed, no
router/guard/HITL/chat behaviour changes.

## Where it lives

- **Module (pure):** `src/lib/agentic/system-map/`
  - `types.ts` — `AgenticSystemMap` (groups / nodes / edges).
  - `derive-system-map-status.ts` — pure status derivation from the live summaries.
  - `build-system-map.ts` — `buildAgenticSystemMap(inputs)`: composes control-center +
    observability + reporting into the graph. Deterministic, no I/O, no Date.now.
  - `index.ts` — `getAgenticSystemMap({ controlCenter, observability, reporting })`.
- **UI:**
  - `src/components/admin/agentic/agentic-system-map.tsx` (Layer 1).
  - `src/components/admin/agentic/agentic-detail-inspector.tsx` (Layer 2 overview).
  - Map styles: `src/app/admin/admin-docs.css` (`.agentic-map-*`, token-only, no hex).
- **Page:** `src/app/admin/agentic/page.tsx` renders the map + inspector first,
  then the existing sections (each given an anchor id the inspector links to).

## Layers, nodes, edges

**Groups (layers):** Control Layer · Crews & Agents · Observability Layer · Tool Layer.

**Node** = `{ id, label, type, status, mode, risk, group, summary, source?, metrics?, detailHref? }`
where `type ∈ router|guard|crew|agent|tool|gate|observability|surface`,
`status ∈ healthy|watch|alert|planned|disabled|no_data`,
`mode ∈ read_only|draft|confirmed_write|forbidden|control|observe`.

**Edge** = `{ id, from, to, label, kind }` where
`kind ∈ routes|reads|guards|gates|observes|composes|forbids`. Edges describe how
the system is **wired** — they are not actions.

**Live/dynamic data:** node statuses are derived from the live summaries —
router status, observability state/storage/aggregation, quality-review active
signals, tool-boundary unknown/critical counts, reporting-crew status. Metrics
(tool counts, decisions in window, etc.) are echoed read-only.

## Agent vs Agentic

Three distinct routes are kept; the two confusing "Bot" nav entries are clarified:

- **Agentic Console** (`/admin/agentic`) — this visual control center (read-only).
  Nav icon: `Workflow`.
- **Agent Library** (`/admin/agents`) — the reusable agent persona **template
  library** (CRUD). Nav icon: `Bot`. It is a distinct function and a navigate-tool
  destination, so it is kept (not merged); only the label/icon are clarified.
- `/admin/agent-canvas/[canvasId]` — the canvas workspace (not in the sub-nav).

The system map links to the Agent Library via the "Agents & Crews" detail anchor.

## How to add a node

Add an `AgenticSystemNode` in `build-system-map.ts` with a `group`, `status`
(derive it from a live summary via a pure helper in `derive-system-map-status.ts`
where possible), `mode`, and `risk`. Give it a `detailHref` anchor if it maps to a
panel below. Keep it read-only — read an existing summary, never call a tool.

## How to add an edge

Add an `AgenticSystemEdge` in `build-system-map.ts` with `from`/`to` node ids and a
`kind`. The builder validates that no edge is dangling (both ends must be real
nodes) via tests. The map renders outgoing edges as "wire" chips on each node plus
a connection legend.

## Safety guarantees

- **No CrewAI, no autonomous runtime, no autonomous loop.**
- No tool execution, no write tools, no send / source / deploy / mark-live.
- No router / guard / HITL / chat behaviour change; no registry runtime change.
- No replay, no export, no prompt editing, no tool-execution UI.
- No DB migration, no Prisma/schema change, no new table.
- No user text / prompt / tool payload stored — only ids, labels, counts, statuses.
- No hardcoded hex in the map CSS — all colors are `--ct-*` tokens / `color-mix`.

## Limits of v0

- The map reflects ONE observability window (default 24h) and is server-rendered:
  node "selection" is via anchor jump-links, not a client-side interactive canvas.
- Edges are rendered as labeled wire chips + a legend (not an SVG flow diagram) to
  stay responsive with no horizontal scroll and no external graph library.

## Visual Integration V1 — Action Readiness + Crew Simulation

The map and the page now integrate two previously-standalone pure modules into the
visual console — still 100% read-only, nothing executes.

### Action Readiness (`src/lib/agentic/action-readiness`)

- `getActionReadinessMatrix()` (in `system-map/index.ts`) builds the matrix
  (`buildActionReadinessMatrix(staticMarker)`, pure) and feeds it to the map.
- New map group **Action Readiness** with nodes: `action-readiness`,
  `read-only-actions`, `draft-actions`, `confirmed-write-actions`,
  `forbidden-actions` — each carries the live tier count (7 / 5 / 1 / 8).
- New edges: `tool-boundary → action-readiness` (classifies);
  `action-readiness → {read-only|draft|confirmed-write}-actions` (reads/gates);
  `action-readiness → forbidden-actions` (forbids); `hitl-gates → draft/confirmed-write
  actions` (confirms); `guard → forbidden-actions` (forbids).
- New section `action-readiness-matrix-section.tsx` (`#action-readiness`): tier count
  cards + four visual **tier lanes**, each action a chip with
  autonomous / HITL / risk badges + reason. No write controls.

### Crew Simulation (`src/lib/agentic/crew-simulation`)

- `getCrewSimulations()` (in `system-map/index.ts`) runs `simulateCrewFlow(id)` for
  every scenario in `CREW_SIMULATION_SCENARIOS` (pure, `executable: false` throughout).
- New map group **Crew Simulation** with nodes: `crew-simulation` + 6 flow nodes
  (`reporting-crew-flow`, `outreach-draft-flow`, `product-review-flow`,
  `risk-explanation-flow`, `vault-readiness-flow`, `memory-distill-flow`) — each
  carries steps / gates / `executable: false`.
- New edges: `crew-simulation → {flow}` (simulates/composes); plus flow wiring —
  `reporting-crew-flow → observability/quality/tool-boundary` (reads),
  `outreach-draft-flow → draft-actions/hitl-gates` (gates),
  `risk-explanation-flow → guard` (guards),
  `vault-readiness-flow → forbidden-actions` (mark-live blocked, forbids),
  `memory-distill-flow / product-review-flow → read-only-actions` (reads).
- New section `crew-simulation-section.tsx` (`#crew-simulation`): each scenario is a
  flow card with a numbered **step rail**, mode/gate badges, blocked actions, and a
  prominent `executable: false` marker. There is no Run / Execute / Launch / Send /
  Deploy / Mark-live control anywhere — a test asserts this.

### Detail inspector

The inspector gained a **Readiness & simulation** rollup (total actions, autonomous
read-only, gated, forbidden, scenarios, executable count = 0) and jump-links to both
new sections.

### No-execution guarantee

Both modules are pure: the matrix is a static classification, the simulations are
deterministic descriptions with `executable: false` at the scenario AND step level.
No tool handler is referenced, no write is performed, no router/guard/HITL/chat
behaviour changes, no Prisma/schema change.

### How to add an action / scenario / node-edge

- **Action**: add it to `src/lib/agentic/action-readiness/actions.ts` (its tier +
  flags); the matrix counts + the tier lane update automatically; the build-time
  `validateItem` guard enforces the tier invariants.
- **Scenario**: add it to `src/lib/agentic/crew-simulation/scenarios.ts` (steps +
  gates + `executable: false`); add a matching `{nodeId, scenarioId, label}` to
  `FLOW_NODES` in `build-system-map.ts` to surface it on the map.
- **Node/edge**: add to `build-system-map.ts` (a `nodes.push(...)` / `edge(...)`);
  tests fail on duplicate ids or dangling edges.

## Next lot recommendation

`Agentic Map — interactive inspector v0.1` (read-only): a client-side selected-node
inspector that filters the detail panels (and the readiness lanes / simulation flows)
to the chosen node, still with no tool execution and no autonomy. Only after V1 is
stable. Do NOT add a crew runtime / CrewAI / any write tool / autonomous loop.

## Control Tower V2 (full redesign)

`/admin/agentic` was fully redesigned into a navigable **Agentic Control Tower**.
The previous version exposed too many equivalent cards and repeated edge-pills,
making the page a documentation wall. V2 restores hierarchy + product meaning
while preserving every read-only data source.

**Structure (`agentic-control-tower.tsx`):**
1. **Command summary** (`agentic-command-summary.tsx`) — overall health, headline
   numbers (autonomous / gated / never-autonomous / agents / crews), the statement
   "nothing executes from this console", and attention items.
2. **Section nav** (`agentic-section-nav.tsx`) — sticky in-page anchor links.
3. **Topology** (`agentic-topology-map.tsx`) — a readable schema of ~8 major blocks
   (Router centre, Guards / HITL / Tool Boundary around, Observability above,
   Agents & Actions outward, Forbidden zone at the edge) — NOT a 32-card grid.
4. **Capabilities** (`agentic-capabilities-board.tsx`) — Autonomous today / Draft only
   / Confirmed-write gated / Never autonomous, in product language.
5. **Agents & Crews** (`agentic-agents-overview.tsx`) — the inventory grouped BY
   DOMAIN into compact lanes (not 22 equal cards).
6. **Actions & Gates** — the action-readiness matrix (tier lanes, unchanged module).
7. **Simulations** — the crew-simulation flows (executable: false, unchanged module).
8. **Observability & Quality** + **Reporting Crew** — the existing read-only sections.
9. **Safety Boundary** (`agentic-safety-boundary.tsx`) — the hard limits in plain
   language: nothing executes here, forbidden-autonomous, human gates, always-on guards.

The headline numbers + health come from a pure `buildTowerSummary()`
(`src/lib/agentic/system-map/tower-summary.ts`). The old `agentic-system-map.tsx`
and `agentic-detail-inspector.tsx` (the card-grid map + inspector) were removed and
replaced by the topology + safety boundary.

**Safety:** no CrewAI, no autonomous runtime, no tool execution, no write controls,
no Run/Execute/Launch/Send/Deploy/Source/Mark-live. No router/guard/HITL/chat change,
no Prisma/schema change, no migration. CSS is token-only (`--ct-*`) with zero
hardcoded hex/rgb/rgba.
