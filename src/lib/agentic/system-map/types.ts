// Agentic System Map v0 — shared types (pure, client-safe).
//
// A read-only, dynamic VISUAL graph of the agentic system: nodes (router, guards,
// crews, agents, tools, gates, observability, surfaces), edges (routes / reads /
// guards / gates / observes / composes / forbids), and groups (layers). Built by
// composing the data the platform already produces — no tool is executed, no LLM
// is called, no write is performed. Pure types — no I/O.

export type AgenticSystemNodeType =
  | "router"
  | "guard"
  | "crew"
  | "agent"
  | "tool"
  | "gate"
  | "observability"
  | "surface";

export type AgenticSystemNodeStatus =
  | "healthy"
  | "watch"
  | "alert"
  | "planned"
  | "disabled"
  | "no_data";

export type AgenticSystemNodeMode =
  | "read_only"
  | "draft"
  | "confirmed_write"
  | "forbidden"
  | "control"
  | "observe";

export type AgenticSystemRisk = "none" | "low" | "medium" | "high" | "critical";

/** A small metric chip rendered inside a node (label + already-formatted value). */
export interface AgenticSystemNodeMetric {
  label: string;
  value: string;
}

export interface AgenticSystemNode {
  id: string;
  label: string;
  type: AgenticSystemNodeType;
  status: AgenticSystemNodeStatus;
  mode: AgenticSystemNodeMode;
  risk: AgenticSystemRisk;
  /** The group/layer id this node belongs to. */
  group: string;
  summary: string;
  /** Source file / route the node reflects (read-only label). */
  source?: string;
  /** Optional live metrics (e.g. tool counts, decisions in window). */
  metrics?: AgenticSystemNodeMetric[];
  /**
   * Optional read-only navigation anchor — an in-page section id OR an admin
   * route this node maps to. NEVER an action; it only links to a detail view. */
  detailHref?: string;
}

export type AgenticSystemEdgeKind =
  | "routes"
  | "reads"
  | "guards"
  | "gates"
  | "observes"
  | "composes"
  | "forbids";

export interface AgenticSystemEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: AgenticSystemEdgeKind;
}

export interface AgenticSystemGroup {
  id: string;
  label: string;
  summary: string;
}

export interface AgenticSystemMap {
  /** Static marker (NOT a live timestamp — pure code has no Date.now). */
  generatedAt: string;
  groups: AgenticSystemGroup[];
  nodes: AgenticSystemNode[];
  edges: AgenticSystemEdge[];
  /** The node selected by default for the inspector's "overview" view. */
  selectedDefaultNodeId: string;
  /** Constant safety notes rendered verbatim. */
  safetyNotes: string[];
}
