import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Live orchestration graph of the platform's agents — now a MULTI-VIEW map.
 *
 * Three honest, live views (tabs in the UI):
 *  - "orchestration": data sources → batch agents → outputs (the original graph).
 *  - "master-agent":  the cockpit chat pipeline (intent → context → core → guard
 *                     → navigate / tools), i.e. the right-side "Jean LLM".
 *  - "instruments":   every bounded read/write tool the Master Agent can call.
 *
 * Each NODE declares a live BINDING (or none → "static" wiring):
 *  - { llmAgent }  → state from the LlmRun table (by agentName).
 *  - { toolId }    → state from the AdminToolRun table (by toolId).
 *  - { toolKind }  → aggregate state from AdminToolRun (all read or all write).
 * A static node (no binding) is structural wiring/method and is NEVER lit as if
 * it ran — provenance honesty (#2): we never fake a "Live" state.
 *
 * Honest by construction: a bound node with no run is `idle` (never lit), a
 * static node is `static`, and a DB error degrades every bound node to idle
 * rather than crashing the page.
 */

export type GraphNodeKind = "source" | "agent" | "tool" | "guard" | "method" | "output";
export type GraphNodeState = "active" | "idle" | "failed" | "static";
export type AgentGraphViewId = "orchestration" | "master-agent" | "instruments";
/** How a node's live state is sourced — surfaced in the UI for provenance. */
export type NodeBindingKind = "llm" | "tool" | "tool-group" | "static";

export interface NodeBinding {
  /** LlmRun.agentName this node maps to. */
  llmAgent?: string;
  /** AdminToolRun.toolId this node maps to. */
  toolId?: string;
  /** AdminToolRun.toolKind aggregate this node maps to. */
  toolKind?: "read" | "write";
}

export interface AgentRunSample {
  status: string;
  atIso: string;
  latencyMs: number | null;
  costUsd: number | null;
}

export interface AgentGraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  /** LlmRun.agentName this node maps to, or null for non-LLM nodes. Kept for the
   *  KPI strip + backwards compatibility (mirrors binding.llmAgent). */
  agentName: string | null;
  /** How this node's live state is sourced (provenance). */
  bindingKind: NodeBindingKind;
  /** One-line description of the surface (shown in the detail panel). */
  description: string | null;
  /** Tool risk level when kind === "tool" (low | medium | high), else null. */
  riskLevel: "low" | "medium" | "high" | null;
  /** True when a write tool requires an explicit confirmation token (HITL). */
  confirmationRequired: boolean;
  state: GraphNodeState;
  lastRunIso: string | null;
  recentRuns: number;
  /** Most recent runs (newest first) for the detail panel. */
  samples: AgentRunSample[];
  /** Layout column (0 = leftmost … rightmost = outputs). */
  column: number;
}

export interface AgentGraphEdge {
  from: string;
  to: string;
  /** True when the target ran recently → animate flow on this edge. */
  hot: boolean;
}

export interface AgentGraph {
  nodes: AgentGraphNode[];
  edges: AgentGraphEdge[];
  generatedAtIso: string;
}

export interface AgentGraphView {
  id: AgentGraphViewId;
  label: string;
  description: string;
  nodes: AgentGraphNode[];
  edges: AgentGraphEdge[];
}

export interface AgentGraphViews {
  views: AgentGraphView[];
  generatedAtIso: string;
}

interface NodeDef {
  id: string;
  label: string;
  kind: GraphNodeKind;
  column: number;
  description?: string;
  binding?: NodeBinding;
  riskLevel?: "low" | "medium" | "high";
  confirmationRequired?: boolean;
}

interface ViewDef {
  id: AgentGraphViewId;
  label: string;
  description: string;
  nodes: readonly NodeDef[];
  edges: ReadonlyArray<[from: string, to: string]>;
}

// ---------------------------------------------------------------------------
// View 1 — Orchestration (data sources → batch agents → outputs)
// ---------------------------------------------------------------------------

const ORCHESTRATION_NODES: readonly NodeDef[] = [
  { id: "market-data", label: "Market Data", kind: "source", column: 0, description: "Mining + vault snapshots feeding the agents." },
  { id: "mining-health", label: "Mining Health", kind: "agent", column: 1, binding: { llmAgent: "mining-health" }, description: "Hashprice / margin health agent." },
  { id: "risk-explanation", label: "Risk Explanation", kind: "agent", column: 1, binding: { llmAgent: "risk-explanation" }, description: "Risk-framework narrative agent." },
  { id: "scenario-narrative", label: "Scenario Narrative", kind: "agent", column: 1, binding: { llmAgent: "scenario-narrative" }, description: "Scenario engine narrative agent." },
  { id: "cockpit-chat", label: "Master Agent", kind: "agent", column: 1, binding: { llmAgent: "cockpit-chat" }, description: "LP / admin cockpit chat (right rail)." },
  { id: "investor-memo", label: "Investor Memo", kind: "agent", column: 2, binding: { llmAgent: "investor-memo" }, description: "Monthly investor memo agent." },
  { id: "memory-distill", label: "Memory Distill", kind: "agent", column: 2, binding: { llmAgent: "memory-distill" }, description: "Distils chats into per-user memory." },
  { id: "outreach-scorer", label: "Outreach Scorer", kind: "agent", column: 2, binding: { llmAgent: "outreach-scorer" }, description: "Scores sourced prospects against the distributor ICP (Apollo pipeline)." },
  { id: "outreach-reply-handler", label: "Reply Handler", kind: "agent", column: 2, binding: { llmAgent: "outreach-reply-handler" }, description: "Classifies inbound replies (interested / unsubscribe / …)." },
  { id: "rebalancing", label: "Rebalancing Signal", kind: "output", column: 3, description: "Advisory rebalancing signal (human-decided)." },
  { id: "outreach", label: "Email Outreach", kind: "output", column: 3, binding: { llmAgent: "email-outreach" }, description: "Investor email outreach." },
  { id: "hubspot", label: "HubSpot Sync", kind: "output", column: 3, description: "CRM contact + memory sync." },
] as const;

const ORCHESTRATION_EDGES: ReadonlyArray<[string, string]> = [
  ["market-data", "mining-health"],
  ["market-data", "risk-explanation"],
  ["market-data", "scenario-narrative"],
  ["market-data", "investor-memo"],
  ["market-data", "rebalancing"],
  ["mining-health", "investor-memo"],
  ["risk-explanation", "rebalancing"],
  ["scenario-narrative", "investor-memo"],
  ["cockpit-chat", "memory-distill"],
  ["memory-distill", "hubspot"],
  ["investor-memo", "outreach"],
  ["outreach-scorer", "outreach"],
  ["outreach", "outreach-reply-handler"],
  ["outreach", "hubspot"],
];

// ---------------------------------------------------------------------------
// View 2 — Master Agent (the cockpit chat pipeline)
// ---------------------------------------------------------------------------

const MASTER_AGENT_NODES: readonly NodeDef[] = [
  { id: "ma-user", label: "User message", kind: "source", column: 0, description: "Inbound chat turn (auth-scoped, sanitized)." },
  { id: "ma-intent", label: "Intent classifier", kind: "method", column: 1, description: "gpt-4.1-nano · product/framing intent → workspace divert. Fail-safe." },
  { id: "ma-ctx-portfolio", label: "Portfolio context", kind: "method", column: 1, description: "Per-user figures, provenance-qualified, guard-validated." },
  { id: "ma-ctx-admin", label: "Admin context", kind: "method", column: 1, description: "Bounded read-tool snapshot (admin mode only)." },
  { id: "ma-core", label: "Master Agent", kind: "agent", column: 2, binding: { llmAgent: "cockpit-chat" }, description: "GPT-4.1 · streamed · single navigate tool exposed." },
  { id: "ma-readtools", label: "Read tools", kind: "tool", column: 3, binding: { toolKind: "read" }, riskLevel: "low", description: "9 bounded read instruments (allowlist, admin)." },
  { id: "ma-guard", label: "Output guard", kind: "guard", column: 3, description: "Forbidden words + APY-always-a-range, mid-stream." },
  { id: "ma-navigate", label: "Navigate tool", kind: "method", column: 4, description: "Closed route whitelist — read-only, no write/financial." },
  { id: "ma-writetools", label: "Write tools (HITL)", kind: "tool", column: 4, binding: { toolKind: "write" }, riskLevel: "high", confirmationRequired: true, description: "Draft-only · confirmation token · human-in-the-loop." },
  { id: "ma-reply", label: "Chat reply", kind: "output", column: 5, description: "Guarded text stream to the cockpit shell." },
  { id: "ma-navbridge", label: "Nav bridge", kind: "output", column: 5, description: "Out-of-band nav channel → client router.push." },
  { id: "ma-memory", label: "Memory distill", kind: "agent", column: 5, binding: { llmAgent: "memory-distill" }, description: "Distils the turn into per-user memory." },
] as const;

const MASTER_AGENT_EDGES: ReadonlyArray<[string, string]> = [
  ["ma-user", "ma-intent"],
  ["ma-user", "ma-ctx-portfolio"],
  ["ma-user", "ma-ctx-admin"],
  ["ma-intent", "ma-core"],
  ["ma-ctx-portfolio", "ma-core"],
  ["ma-ctx-admin", "ma-core"],
  ["ma-core", "ma-readtools"],
  ["ma-core", "ma-guard"],
  ["ma-core", "ma-navigate"],
  ["ma-core", "ma-writetools"],
  ["ma-guard", "ma-reply"],
  ["ma-navigate", "ma-navbridge"],
  ["ma-reply", "ma-memory"],
];

// ---------------------------------------------------------------------------
// View 3 — Instruments (every bounded tool the Master Agent can call)
// ---------------------------------------------------------------------------

/** Static catalog of the admin tools — mirrors src/lib/llm/tools/registry.ts.
 *  Kept inline (not imported) so this module stays dependency-light; the LIVE
 *  part is the AdminToolRun telemetry keyed by these ids. */
interface ToolCatalogEntry {
  id: string;
  label: string;
  description: string;
  kind: "read" | "write";
  riskLevel: "low" | "medium" | "high";
  confirmationRequired: boolean;
}

const ADMIN_READ_TOOL_CATALOG: readonly ToolCatalogEntry[] = [
  { id: "read_allocations_canonical", label: "Allocations", description: "Canonical allocations for all vaults.", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "read_market_snapshot", label: "Market snapshot", description: "Latest mining + vault snapshots (BTC live).", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "read_routes_index", label: "Routes index", description: "Product routes index sample.", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "read_specs_index", label: "Specs index", description: "Spec documents index sample.", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "read_runtime_capabilities", label: "Capabilities", description: "Runtime capabilities matrix.", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "generate_chart_spec", label: "Chart spec", description: "Deterministic chart specification from data.", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "generate_demo_plan", label: "Demo plan", description: "Ordered admin demo plan from routes/specs.", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "export_demo_pack", label: "Demo pack", description: "Structured demo pack (plan, charts, checklist).", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "export_briefing_pack", label: "Briefing pack", description: "Executive briefing package (summary, risks).", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "outreach_list_prospects", label: "List prospects", description: "List outreach prospects by tier / status.", kind: "read", riskLevel: "low", confirmationRequired: false },
  { id: "outreach_stats", label: "Outreach stats", description: "Pipeline counts by tier and status.", kind: "read", riskLevel: "low", confirmationRequired: false },
] as const;

const ADMIN_WRITE_TOOL_CATALOG: readonly ToolCatalogEntry[] = [
  { id: "create_review_note_draft", label: "Review note draft", description: "Create an admin review note draft (draft only).", kind: "write", riskLevel: "medium", confirmationRequired: true },
  { id: "create_governance_proposal_draft", label: "Governance proposal draft", description: "Create a governance proposal draft (draft only).", kind: "write", riskLevel: "high", confirmationRequired: true },
  { id: "outreach_source_leads", label: "Source leads", description: "Source distributor leads via Apollo (scored + tiered); sends nothing.", kind: "write", riskLevel: "medium", confirmationRequired: true },
  { id: "outreach_draft_email", label: "Draft email", description: "Draft a distributor email for a prospect; sends nothing.", kind: "write", riskLevel: "medium", confirmationRequired: true },
  { id: "outreach_trigger_send_run", label: "Trigger send run", description: "Run the governed auto-send job (autonomy dial; never Tier A).", kind: "write", riskLevel: "high", confirmationRequired: true },
] as const;

function buildInstrumentsView(): ViewDef {
  const caller: NodeDef = {
    id: "inst-master",
    label: "Master Agent",
    kind: "agent",
    column: 0,
    binding: { llmAgent: "cockpit-chat" },
    description: "Caller — admin mode, bounded tool allowlist.",
  };
  const readNodes: NodeDef[] = ADMIN_READ_TOOL_CATALOG.map((t) => ({
    id: `inst-${t.id}`,
    label: t.label,
    kind: "tool",
    column: 1,
    binding: { toolId: t.id },
    riskLevel: t.riskLevel,
    confirmationRequired: t.confirmationRequired,
    description: t.description,
  }));
  const writeNodes: NodeDef[] = ADMIN_WRITE_TOOL_CATALOG.map((t) => ({
    id: `inst-${t.id}`,
    label: t.label,
    kind: "tool",
    column: 2,
    binding: { toolId: t.id },
    riskLevel: t.riskLevel,
    confirmationRequired: t.confirmationRequired,
    description: t.description,
  }));
  const nodes = [caller, ...readNodes, ...writeNodes];
  const edges: Array<[string, string]> = [
    ...readNodes.map((n): [string, string] => ["inst-master", n.id]),
    ...writeNodes.map((n): [string, string] => ["inst-master", n.id]),
  ];
  return {
    id: "instruments",
    label: "Instruments",
    description:
      "Every bounded read/write tool the Master Agent can call — live runs from AdminToolRun. Write tools are draft-only and human-confirmed.",
    nodes,
    edges,
  };
}

const VIEW_DEFS: readonly ViewDef[] = [
  {
    id: "orchestration",
    label: "Orchestration",
    description:
      "Data sources feed the LLM agents, which feed the outputs. Particles flow on edges that just ran; nodes pulse by live state.",
    nodes: ORCHESTRATION_NODES,
    edges: ORCHESTRATION_EDGES,
  },
  {
    id: "master-agent",
    label: "Master Agent",
    description:
      "The cockpit chat pipeline (right rail): intent → context → core → guard → navigate / tools. Static wiring is neutral; bound surfaces light up live.",
    nodes: MASTER_AGENT_NODES,
    edges: MASTER_AGENT_EDGES,
  },
  buildInstrumentsView(),
] as const;

// ---------------------------------------------------------------------------
// Live state resolution
// ---------------------------------------------------------------------------

const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // 10 min → "active" + hot edge
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h window
const MAX_SAMPLES = 5;

interface RunAggregate {
  samples: AgentRunSample[];
  count: number;
}

function bindingKindOf(binding?: NodeBinding): NodeBindingKind {
  if (binding?.llmAgent) return "llm";
  if (binding?.toolId) return "tool";
  if (binding?.toolKind) return "tool-group";
  return "static";
}

/** Resolve live state for one node from the prebuilt aggregates. */
function resolveNodeState(
  def: NodeDef,
  byAgent: Map<string, RunAggregate>,
  byToolId: Map<string, RunAggregate>,
  byToolKind: Map<string, RunAggregate>,
  now: number,
): {
  state: GraphNodeState;
  lastRunIso: string | null;
  recentRuns: number;
  samples: AgentRunSample[];
} {
  const kind = bindingKindOf(def.binding);
  let agg: RunAggregate | undefined;
  if (kind === "llm") agg = byAgent.get(def.binding!.llmAgent!);
  else if (kind === "tool") agg = byToolId.get(def.binding!.toolId!);
  else if (kind === "tool-group") agg = byToolKind.get(def.binding!.toolKind!);
  else return { state: "static", lastRunIso: null, recentRuns: 0, samples: [] };

  const latest = agg?.samples[0] ?? null;
  const lastRunMs = latest ? new Date(latest.atIso).getTime() : null;
  let state: GraphNodeState = "idle";
  if (latest) {
    if (latest.status === "failed" || latest.status === "timeout") {
      state = "failed";
    } else if (lastRunMs !== null && now - lastRunMs <= ACTIVE_WINDOW_MS) {
      state = "active";
    }
  }
  return {
    state,
    lastRunIso: latest?.atIso ?? null,
    recentRuns: agg?.count ?? 0,
    samples: agg?.samples ?? [],
  };
}

function resolveView(
  def: ViewDef,
  byAgent: Map<string, RunAggregate>,
  byToolId: Map<string, RunAggregate>,
  byToolKind: Map<string, RunAggregate>,
  now: number,
): AgentGraphView {
  const nodes: AgentGraphNode[] = def.nodes.map((n) => {
    const live = resolveNodeState(n, byAgent, byToolId, byToolKind, now);
    return {
      id: n.id,
      label: n.label,
      kind: n.kind,
      agentName: n.binding?.llmAgent ?? null,
      bindingKind: bindingKindOf(n.binding),
      description: n.description ?? null,
      riskLevel: n.riskLevel ?? null,
      confirmationRequired: n.confirmationRequired ?? false,
      state: live.state,
      lastRunIso: live.lastRunIso,
      recentRuns: live.recentRuns,
      samples: live.samples,
      column: n.column,
    };
  });

  const stateById = new Map(nodes.map((n) => [n.id, n.state]));
  const edges: AgentGraphEdge[] = def.edges.map(([from, to]) => ({
    from,
    to,
    // An edge is hot when its TARGET is currently active (data just flowed in).
    hot: stateById.get(to) === "active",
  }));

  return { id: def.id, label: def.label, description: def.description, nodes, edges };
}

// ---------------------------------------------------------------------------
// Aggregators
// ---------------------------------------------------------------------------

function aggregateLlmRuns(
  rows: Array<{
    agentName: string;
    status: string;
    createdAt: Date;
    latencyMs: number | null;
    costUsd: number | null;
  }>,
): Map<string, RunAggregate> {
  const map = new Map<string, RunAggregate>();
  for (const row of rows) {
    const entry = map.get(row.agentName) ?? { samples: [], count: 0 };
    entry.count += 1;
    if (entry.samples.length < MAX_SAMPLES) {
      entry.samples.push({
        status: row.status,
        atIso: row.createdAt.toISOString(),
        latencyMs: row.latencyMs,
        costUsd: row.costUsd,
      });
    }
    map.set(row.agentName, entry);
  }
  return map;
}

function aggregateToolRuns(
  rows: Array<{
    toolId: string;
    toolKind: string;
    status: string;
    createdAt: Date;
    latencyMs: number | null;
  }>,
): { byToolId: Map<string, RunAggregate>; byToolKind: Map<string, RunAggregate> } {
  const byToolId = new Map<string, RunAggregate>();
  const byToolKind = new Map<string, RunAggregate>();
  for (const row of rows) {
    const sample: AgentRunSample = {
      status: row.status,
      atIso: row.createdAt.toISOString(),
      latencyMs: row.latencyMs,
      costUsd: null,
    };
    const byId = byToolId.get(row.toolId) ?? { samples: [], count: 0 };
    byId.count += 1;
    if (byId.samples.length < MAX_SAMPLES) byId.samples.push(sample);
    byToolId.set(row.toolId, byId);

    const byKind = byToolKind.get(row.toolKind) ?? { samples: [], count: 0 };
    byKind.count += 1;
    if (byKind.samples.length < MAX_SAMPLES) byKind.samples.push(sample);
    byToolKind.set(row.toolKind, byKind);
  }
  return { byToolId, byToolKind };
}

// ---------------------------------------------------------------------------
// Public loaders
// ---------------------------------------------------------------------------

/**
 * Load the single ORCHESTRATION graph (LlmRun only).
 *
 * Kept for the /admin/agents KPI strip and backwards compatibility — it never
 * touches AdminToolRun, so existing callers/tests are unaffected.
 */
export async function loadAgentGraph(now: number = Date.now()): Promise<AgentGraph> {
  const generatedAtIso = new Date(now).toISOString();
  let byAgent = new Map<string, RunAggregate>();

  try {
    const rows = await prisma.llmRun.findMany({
      where: { createdAt: { gte: new Date(now - RECENT_WINDOW_MS) } },
      select: {
        agentName: true,
        status: true,
        createdAt: true,
        latencyMs: true,
        costUsd: true,
      },
      orderBy: { createdAt: "desc" },
      take: 800,
    });
    byAgent = aggregateLlmRuns(rows);
  } catch (err) {
    logger.warn(
      "agent graph load failed — degrading all nodes to idle",
      {},
      err instanceof Error ? err : undefined,
    );
    byAgent = new Map();
  }

  const empty = new Map<string, RunAggregate>();
  const orchestration = VIEW_DEFS.find((v) => v.id === "orchestration")!;
  const view = resolveView(orchestration, byAgent, empty, empty, now);
  return { nodes: view.nodes, edges: view.edges, generatedAtIso };
}

/**
 * Load ALL graph views (LlmRun + AdminToolRun) for the multi-tab canvas.
 *
 * Degrades gracefully: a failure on either table leaves its bound nodes idle
 * (the page still renders the full topology).
 */
export async function loadAgentGraphViews(
  now: number = Date.now(),
): Promise<AgentGraphViews> {
  const generatedAtIso = new Date(now).toISOString();
  const since = new Date(now - RECENT_WINDOW_MS);

  let byAgent = new Map<string, RunAggregate>();
  let byToolId = new Map<string, RunAggregate>();
  let byToolKind = new Map<string, RunAggregate>();

  try {
    const rows = await prisma.llmRun.findMany({
      where: { createdAt: { gte: since } },
      select: { agentName: true, status: true, createdAt: true, latencyMs: true, costUsd: true },
      orderBy: { createdAt: "desc" },
      take: 800,
    });
    byAgent = aggregateLlmRuns(rows);
  } catch (err) {
    logger.warn("agent graph: LlmRun load failed — LLM nodes idle", {}, err instanceof Error ? err : undefined);
  }

  try {
    const rows = await prisma.adminToolRun.findMany({
      where: { createdAt: { gte: since } },
      select: { toolId: true, toolKind: true, status: true, createdAt: true, latencyMs: true },
      orderBy: { createdAt: "desc" },
      take: 800,
    });
    const agg = aggregateToolRuns(rows);
    byToolId = agg.byToolId;
    byToolKind = agg.byToolKind;
  } catch (err) {
    logger.warn("agent graph: AdminToolRun load failed — tool nodes idle", {}, err instanceof Error ? err : undefined);
  }

  const views = VIEW_DEFS.map((def) =>
    resolveView(def, byAgent, byToolId, byToolKind, now),
  );
  return { views, generatedAtIso };
}
