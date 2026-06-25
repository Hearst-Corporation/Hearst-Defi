// Agentic Control Center — shared types (v0.1).
//
// READ-ONLY visibility layer. These types describe a STATIC inventory of the
// agentic chain (agents, routers, tools, gates, prompts) so admins can see what
// exists in code without executing anything. No DB, no LLM, no I/O — this module
// is client-safe and pure.
//
// v0.1 widens the vocabulary (server_action / registry / prompt / observability
// types, planned status, none/critical risk) and adds a top-level aggregate
// (AgenticControlCenterData) without breaking the v0 surface.

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/** Where a piece of logic sits in the agentic chain. */
export type AgenticItemType =
  | "chat"
  | "router"
  | "batch-agent"
  | "tool"
  | "validator"
  | "canvas"
  | "guard"
  | "worker"
  | "server-action"
  | "registry"
  | "prompt"
  | "observability";

/** Operational status of a piece of logic. */
export type AgenticStatus =
  | "active"
  | "shadow"
  | "read-only"
  | "gated"
  | "legacy"
  | "planned"
  | "unknown";

/** Coarse risk classification for visibility (not a runtime control). */
export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

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
  /** Where this item's prompt(s) live, if any. */
  promptLocations?: string[];
  type: AgenticItemType;
  status: AgenticStatus;
  /** Can this logic, by itself, produce a persisted write? */
  writesAllowed: boolean;
  /** Does any write it touches require a human gate (HITL)? */
  humanGateRequired: boolean;
  riskLevel: RiskLevel;
  notes: string;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/** Router active/shadow/legacy path visibility. */
export interface RouterPath {
  id: string;
  label: string;
  /** active = wired into control flow; shadow = classified but not acted on. */
  mode: "active" | "shadow" | "legacy";
  notes: string;
}

/** One asserted guard property in the Router-stabilization final state. */
export interface RouterGuardAssertion {
  id: string;
  label: string;
  /** true = the property holds (verified from repo / lot close). */
  holds: boolean;
  evidence: string;
}

/** Release / validation metadata for the closed Router-stabilization lot.
 *  Static facts captured at lot close — NOT a live build status. */
export interface RouterReleaseSummary {
  /** "closed" once the lot merged + Vercel READY. */
  lotStatus: "closed" | "open";
  mergeCommit: string;
  mergePr: string;
  lockReleaseCommit: string;
  lockReleasePr: string;
  vercel: "ready" | "pending" | "failed";
  /** Validation line items captured at lot close. */
  validations: { id: string; label: string; result: string; pass: boolean }[];
}

export interface RouterStatusSummary {
  deterministicRouterExists: boolean;
  /** active = wired non-shadow into the chat control flow. */
  status: "active" | "shadow" | "legacy";
  /** "non-shadow" once the router drives control flow (not just logs). */
  mode: "non-shadow" | "shadow";
  /** Which router version is wired into the chat route. */
  version: string;
  /** The AGENTIC_ROUTER_SHADOW flag: dead once the router is non-shadow. */
  shadowFlag: { name: string; alive: boolean; notes: string };
  routerPaths: RouterPath[];
  /** Convenience string lists for the summary panel. */
  activePaths: string[];
  shadowOnlyPaths: string[];
  educationalSteering: string;
  dangerousIntentPolicy: string;
  guardPolicy: string;
  /** Guard-handoff assertions (guard never relaxed by the router). */
  guardAssertions: RouterGuardAssertion[];
  /** Verbatim Router Status block rendered as-is in /admin/agentic. */
  statusBlock: string[];
  /** Closed-lot release / validation metadata. */
  release: RouterReleaseSummary;
  /** Source files. */
  paths: string[];
  legacyFallback: {
    status: AgenticStatus;
    notes: string;
  };
}

// ---------------------------------------------------------------------------
// Tool boundary
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Human gates
// ---------------------------------------------------------------------------

/** A critical human gate protecting a sensitive action. */
export interface HumanGate {
  id: string;
  action: string;
  domain: string;
  /** Can the chat / an agent ever perform this autonomously? */
  autonomousAllowed: boolean;
  requiresHuman: boolean;
  requiresAdmin: boolean;
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
  /** Specific actions this gate protects. */
  protectedActions: string[];
  paths: string[];
  notes: string;
}

// ---------------------------------------------------------------------------
// Prompt map
// ---------------------------------------------------------------------------

/** Pointer to where a class of prompt / guard text lives. */
export interface PromptMapEntry {
  id: string;
  kind: "system" | "agent" | "canvas" | "guard" | "methodology";
  label: string;
  domain: string;
  paths: string[];
  /** Always false in v0.1 — prompts are not editable from the UI. */
  editableInUi: false;
  summary: string;
}

// ---------------------------------------------------------------------------
// Safety + next steps
// ---------------------------------------------------------------------------

export interface SafetySummaryItem {
  id: string;
  claim: string;
  /** true = the safety property holds (verified from repo/docs). */
  holds: boolean;
  evidence: string;
}

export interface NextStepItem {
  id: string;
  title: string;
  why: string;
  /** Honest scope marker: this is planned, not built. */
  status: "planned";
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export interface AgenticControlCenterData {
  /** Static-registry marker — NOT a live timestamp (no Date.now in pure code). */
  generatedAt: string;
  version: string;
  router: RouterStatusSummary;
  inventory: AgenticInventoryItem[];
  gates: HumanGate[];
  tools: ToolBoundaryEntry[];
  prompts: PromptMapEntry[];
  safetySummary: SafetySummaryItem[];
  nextSteps: NextStepItem[];
}
