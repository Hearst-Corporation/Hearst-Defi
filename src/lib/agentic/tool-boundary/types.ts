// Tool Boundary v1 — shared types (pure, client-safe).
//
// A READ-ONLY reflection of the real LLM tool registry. Describes each tool's
// tier, gate, risk, and runtime exposure WITHOUT executing it. No I/O here.

/** The boundary tier a tool sits in. */
export type ToolBoundaryTier =
  | "read_only" // bounded reads / read-only generation, no DB write, no confirmation
  | "draft_or_proposal" // persists a DRAFT/proposal state only, HITL-gated
  | "confirmed_write" // a confirmed write with an external effect, HITL-gated
  | "forbidden_autonomous" // an action that must NEVER be autonomous (not exposed as a tool)
  | "unknown"; // a real tool with no classification — must raise a warning

/** Risk associated with a tool's effect. */
export type ToolBoundaryRiskLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

/** How the tool is currently exposed at runtime. */
export type ToolBoundaryRuntimeStatus =
  | "available" // exposed and callable (subject to policy/gate)
  | "gated" // exposed but requires a HITL confirmation token before any effect
  | "not_exposed" // represented as a forbidden action, NOT a callable tool
  | "unknown";

/** One reflected tool boundary item. */
export interface ReflectedToolBoundaryItem {
  id: string;
  name: string;
  description?: string;
  tier: ToolBoundaryTier;
  /** Source file the tool / action is defined or represented in. */
  source: string;
  /** True only for tools that may act on the intent without a human in the loop. */
  autonomousAllowed: boolean;
  /** True when a human gate (confirmation token / admin server action) protects it. */
  humanGateRequired: boolean;
  /** True when admin role is required to reach the tool. */
  adminRequired: boolean;
  /** True when a two-step confirmation token is required before any persisted effect. */
  confirmationRequired: boolean;
  riskLevel: ToolBoundaryRiskLevel;
  runtimeStatus: ToolBoundaryRuntimeStatus;
  notes: string;
}

/** A consistency issue between the reflected code and the static representation. */
export interface ToolBoundaryConsistencyIssue {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
}

/** Per-tier counts (every tier always present, default 0). */
export type ToolBoundaryTierCounts = Record<ToolBoundaryTier, number>;

/** The read-only Tool Boundary v1 summary the Control Center renders. */
export interface ToolBoundaryV1Summary {
  /** Static marker (NOT a live timestamp — pure code has no Date.now). */
  generatedAt: string;
  source: "code_reflection";
  counts: ToolBoundaryTierCounts;
  tools: ReflectedToolBoundaryItem[];
  consistencyIssues: ToolBoundaryConsistencyIssue[];
  safetyNotes: string[];
}
