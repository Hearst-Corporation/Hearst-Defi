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

## Next lot recommendation

`Agentic Map — interactive inspector v0.1` (read-only): a client-side selected-node
inspector that filters the detail panels to the chosen node, still with no tool
execution and no autonomy. Only after v0 is stable. Do NOT add a crew runtime /
CrewAI / any write tool / autonomous loop.
