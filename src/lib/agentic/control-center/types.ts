// Agentic Control Center v0 — shared types.
//
// READ-ONLY visibility layer. These types describe a STATIC inventory of the
// agentic chain (agents, routers, tools, gates, prompts) so admins can see what
// exists in code without executing anything. No DB, no LLM, no I/O — this module
// is client-safe and pure.

/** Where a piece of logic sits in the agentic chain. */
export type AgenticItemType =
  | "chat"
  | "router"
  | "batch-agent"
  | "tool"
  | "validator"
  | "canvas"
  | "guard"
  | "worker";

/** Operational status of a piece of logic. */
export type AgenticStatus =
  | "active"
  | "shadow"
  | "read-only"
  | "gated"
  | "legacy"
  | "unknown";

/** Coarse risk classification for visibility (not a runtime control). */
export type RiskLevel = "low" | "medium" | "high";

/** One entry in the agent / logic inventory. */
export interface AgenticInventoryItem {
  /** Stable id for tests + keys. */
  id: string;
  /** Human-facing name. */
  name: string;
  /** Product domain (chat, outreach, scenario, vault, compliance, memory…). */
  domain: string;
  /** Source-of-truth file path(s), relative to repo root. */
  paths: string[];
  type: AgenticItemType;
  status: AgenticStatus;
  /** Can this logic, by itself, produce a persisted write? */
  writesAllowed: boolean;
  /** Does any write it touches require a human gate (HITL)? */
  humanGateRequired: boolean;
  riskLevel: RiskLevel;
  notes: string;
}

/** Router active/shadow/legacy path visibility. */
export interface RouterPath {
  id: string;
  label: string;
  /** active = wired into control flow; shadow = classified but not acted on. */
  mode: "active" | "shadow" | "legacy";
  notes: string;
}

export interface RouterStatusSummary {
  deterministicRouterExists: boolean;
  /** Which router version is wired into the chat route. */
  version: string;
  routerPaths: RouterPath[];
  paths: string[];
  legacyFallback: {
    status: AgenticStatus;
    notes: string;
  };
}

/** Tool boundary categories — what the model may call, and what it may never do. */
export type ToolBoundaryCategory =
  | "read-only"
  | "draft-proposal"
  | "confirmed-write"
  | "forbidden-autonomous";

export interface ToolBoundaryEntry {
  category: ToolBoundaryCategory;
  label: string;
  /** Tool ids / action names in this category. */
  items: string[];
  /** Always requires a HITL confirmation token before any persisted effect? */
  requiresConfirmation: boolean;
  notes: string;
}

/** A critical human gate protecting a sensitive action. */
export interface HumanGate {
  id: string;
  action: string;
  /** Can the chat / an agent ever perform this autonomously? */
  autonomousAllowed: boolean;
  requiresAdmin: boolean;
  requiresConfirmation: boolean;
  paths: string[];
  notes: string;
}

/** Pointer to where a class of prompt / guard text lives. */
export interface PromptMapEntry {
  id: string;
  kind: "system" | "agent" | "canvas" | "guard";
  label: string;
  paths: string[];
  summary: string;
}

export interface SafetySummaryItem {
  id: string;
  claim: string;
  /** true = the safety property holds (verified from repo/docs). */
  holds: boolean;
  evidence: string;
}
