import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Live orchestration graph of the platform's agents.
 *
 * NODES are the real execution surfaces (data sources, LLM agents, outputs);
 * EDGES are the real wiring between them (Inngest events + data dependencies,
 * see src/lib/inngest/functions/*). The TOPOLOGY is static — it mirrors how the
 * jobs are wired — while each node's STATE + runtime metrics come live from the
 * LlmRun table. An edge is "hot" when its target node ran recently.
 *
 * Honest by construction: a node with no run is `idle` (never lit), and a DB
 * error degrades every node to idle rather than crashing the page.
 */

export type GraphNodeKind = "source" | "agent" | "output";
export type GraphNodeState = "active" | "idle" | "failed";

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
  /** LlmRun.agentName this node maps to, or null for non-LLM nodes (sources/outputs). */
  agentName: string | null;
  state: GraphNodeState;
  lastRunIso: string | null;
  recentRuns: number;
  /** Most recent runs (newest first) for the detail panel. */
  samples: AgentRunSample[];
  /** Layout column (0 = sources … rightmost = outputs). */
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

interface NodeDef {
  id: string;
  label: string;
  kind: GraphNodeKind;
  agentName: string | null;
  column: number;
}

/** Static topology — mirrors the Inngest wiring (data sources → agents → outputs). */
const NODE_DEFS: readonly NodeDef[] = [
  { id: "market-data", label: "Market Data", kind: "source", agentName: null, column: 0 },
  { id: "mining-health", label: "Mining Health", kind: "agent", agentName: "mining-health", column: 1 },
  { id: "risk-explanation", label: "Risk Explanation", kind: "agent", agentName: "risk-explanation", column: 1 },
  { id: "scenario-narrative", label: "Scenario Narrative", kind: "agent", agentName: "scenario-narrative", column: 1 },
  { id: "cockpit-chat", label: "Master Agent", kind: "agent", agentName: "cockpit-chat", column: 1 },
  { id: "investor-memo", label: "Investor Memo", kind: "agent", agentName: "investor-memo", column: 2 },
  { id: "memory-distill", label: "Memory Distill", kind: "agent", agentName: "memory-distill", column: 2 },
  { id: "rebalancing", label: "Rebalancing Signal", kind: "output", agentName: null, column: 3 },
  { id: "outreach", label: "Email Outreach", kind: "output", agentName: "email-outreach", column: 3 },
  { id: "hubspot", label: "HubSpot Sync", kind: "output", agentName: null, column: 3 },
] as const;

const EDGE_DEFS: ReadonlyArray<[from: string, to: string]> = [
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
  ["outreach", "hubspot"],
];

const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // 10 min → "active" + hot edge
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h window
const MAX_SAMPLES = 5;

interface AgentAggregate {
  samples: AgentRunSample[];
  count: number;
}

export async function loadAgentGraph(now: number = Date.now()): Promise<AgentGraph> {
  const generatedAtIso = new Date(now).toISOString();
  let byAgent = new Map<string, AgentAggregate>();

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
    byAgent = aggregate(rows);
  } catch (err) {
    logger.warn(
      "agent graph load failed — degrading all nodes to idle",
      {},
      err instanceof Error ? err : undefined,
    );
    byAgent = new Map();
  }

  const nodes: AgentGraphNode[] = NODE_DEFS.map((def) => {
    const agg = def.agentName ? byAgent.get(def.agentName) : undefined;
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
      id: def.id,
      label: def.label,
      kind: def.kind,
      agentName: def.agentName,
      state,
      lastRunIso: latest?.atIso ?? null,
      recentRuns: agg?.count ?? 0,
      samples: agg?.samples ?? [],
      column: def.column,
    };
  });

  const stateById = new Map(nodes.map((n) => [n.id, n.state]));
  const edges: AgentGraphEdge[] = EDGE_DEFS.map(([from, to]) => ({
    from,
    to,
    // An edge is hot when its TARGET is currently active (data just flowed in).
    hot: stateById.get(to) === "active",
  }));

  return { nodes, edges, generatedAtIso };
}

function aggregate(
  rows: Array<{
    agentName: string;
    status: string;
    createdAt: Date;
    latencyMs: number | null;
    costUsd: number | null;
  }>,
): Map<string, AgentAggregate> {
  const map = new Map<string, AgentAggregate>();
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
