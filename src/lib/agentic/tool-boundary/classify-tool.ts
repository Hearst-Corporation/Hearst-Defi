// Tool Boundary v1 — classification (pure, NO execution).
//
// Maps a reflected real tool id (+ curated metadata) into a tier + gate + risk
// boundary item. Encodes the SAFETY rules:
//   - read tools → read_only, autonomous-allowed (bounded reads only), no gate
//   - write tools → draft_or_proposal OR confirmed_write, NEVER autonomous, gated
//   - an unclassified real tool → unknown, high risk, NOT autonomous (fail safe)
//   - forbidden actions (deploy/source/mark_live/…) → forbidden_autonomous,
//     not exposed as a tool.

import type {
  ReflectedToolBoundaryItem,
  ToolBoundaryRiskLevel,
} from "./types";
import {
  TOOL_REGISTRY_SOURCE,
  reflectRealToolIds,
  type ReflectedToolId,
} from "./registry-reflection";

/** Lift a registry low/medium/high risk to the boundary risk scale. */
function liftRisk(
  risk: "low" | "medium" | "high",
): ToolBoundaryRiskLevel {
  return risk; // both scales share these labels; "none"/"critical" are boundary-only
}

/**
 * Classify ONE reflected tool id. Pure. An unclassified real tool (no curated
 * metadata) fails safe: tier "unknown", risk "high", autonomousAllowed false,
 * gate required — and the consistency layer raises a warning.
 */
export function classifyReflectedTool(
  reflected: ReflectedToolId,
): ReflectedToolBoundaryItem {
  const { id, kind, meta } = reflected;

  // Unclassified real tool → fail safe.
  if (!meta) {
    return {
      id,
      name: id,
      tier: "unknown",
      source: TOOL_REGISTRY_SOURCE,
      autonomousAllowed: false,
      humanGateRequired: kind === "write",
      adminRequired: true,
      confirmationRequired: kind === "write",
      riskLevel: "high",
      runtimeStatus: "unknown",
      notes:
        "Real registry tool with no boundary classification. Treated as high-risk, non-autonomous until classified. Classify it in registry-reflection.ts.",
    };
  }

  if (kind === "read") {
    // Read tools: bounded reads / read-only generation. No DB write, no token.
    // Autonomous-allowed in the sense that the model may CALL them without a human
    // gate — but they can only READ, never act.
    return {
      id,
      name: id,
      description: meta.description,
      tier: "read_only",
      source: TOOL_REGISTRY_SOURCE,
      autonomousAllowed: true,
      humanGateRequired: false,
      adminRequired: true,
      confirmationRequired: false,
      riskLevel: liftRisk(meta.riskLevel),
      runtimeStatus: "available",
      notes:
        "Bounded read / read-only generation. No DB write, no confirmation. admin chat mode + admin profile per policy.ts.",
    };
  }

  // Write tools: ALWAYS gated (confirmationRequired:true) + NEVER autonomous.
  const tier = meta.externalEffect ? "confirmed_write" : "draft_or_proposal";
  const notes = meta.externalEffect
    ? "The only tool with an external effect. Two-step HITL confirmation token, admin-only. Runs the SAME governed send job (never bypasses it); Tier A never auto-sent."
    : "Persists a DRAFT / proposal state ONLY — never live/executed/sent. Two-step input-bound single-use HITL confirmation token before any DB write.";

  return {
    id,
    name: id,
    description: meta.description,
    tier,
    source: TOOL_REGISTRY_SOURCE,
    autonomousAllowed: false,
    humanGateRequired: true,
    adminRequired: true,
    confirmationRequired: true,
    riskLevel: liftRisk(meta.riskLevel),
    runtimeStatus: "gated",
    notes,
  };
}

/**
 * Forbidden-autonomous ACTIONS — represented, NOT callable tools. These exist in
 * the platform as human-gated admin server actions or are out of the agentic
 * surface entirely (ADR-012 / ADR-016 / ADR-017). They are listed so the boundary
 * is honest about what an agent must NEVER do autonomously.
 */
export const FORBIDDEN_AUTONOMOUS_ACTIONS: ReflectedToolBoundaryItem[] = [
  {
    id: "financial_or_custodial_action",
    name: "Any financial / custodial action",
    tier: "forbidden_autonomous",
    source: "n/a (not exposed as a tool)",
    autonomousAllowed: false,
    humanGateRequired: true,
    adminRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    runtimeStatus: "not_exposed",
    notes: "Never reachable from the chat or an agent (ADR-012).",
  },
  {
    id: "safe_multisig_signature",
    name: "Safe / multisig signature",
    tier: "forbidden_autonomous",
    source: "human-gated admin action",
    autonomousAllowed: false,
    humanGateRequired: true,
    adminRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    runtimeStatus: "not_exposed",
    notes: "Human-signed on-chain action; never an agent tool.",
  },
  {
    id: "vault_mark_live",
    name: "Vault promote / markAsLive",
    tier: "forbidden_autonomous",
    source: "src/app/admin/vaults/* state machine",
    autonomousAllowed: false,
    humanGateRequired: true,
    adminRequired: true,
    confirmationRequired: true,
    riskLevel: "high",
    runtimeStatus: "not_exposed",
    notes:
      "Going live is a separate state-machine action, deliberately NOT a tool — create_vault_draft can only draft.",
  },
  {
    id: "mainnet_deploy",
    name: "Mainnet deploy",
    tier: "forbidden_autonomous",
    source: "gated on Spearbit audit (ADR-006)",
    autonomousAllowed: false,
    humanGateRequired: true,
    adminRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    runtimeStatus: "not_exposed",
    notes: "Mainnet deploy stays gated on a completed audit; never an agent tool.",
  },
  {
    id: "db_migration",
    name: "DB migration",
    tier: "forbidden_autonomous",
    source: "prisma migrate (operator only)",
    autonomousAllowed: false,
    humanGateRequired: true,
    adminRequired: true,
    confirmationRequired: true,
    riskLevel: "high",
    runtimeStatus: "not_exposed",
    notes: "Schema changes are operator-run, never an agent tool.",
  },
  {
    id: "governance_execute",
    name: "Governance execution",
    tier: "forbidden_autonomous",
    source: "multisig page (not a tool)",
    autonomousAllowed: false,
    humanGateRequired: true,
    adminRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    runtimeStatus: "not_exposed",
    notes:
      "Only create_governance_proposal_draft exists (DRAFT only); execution is a human multisig action.",
  },
  {
    id: "formula_methodology_change",
    name: "Formula / methodology change",
    tier: "forbidden_autonomous",
    source: "docs/methodology (versioned, human)",
    autonomousAllowed: false,
    humanGateRequired: true,
    adminRequired: true,
    confirmationRequired: true,
    riskLevel: "high",
    runtimeStatus: "not_exposed",
    notes: "Methodology is versioned + human-changed; never an agent tool.",
  },
  {
    id: "tier_a_outreach_auto_send",
    name: "Tier A outreach auto-send",
    tier: "forbidden_autonomous",
    source: "ADR-016 (never auto-sent)",
    autonomousAllowed: false,
    humanGateRequired: true,
    adminRequired: true,
    confirmationRequired: true,
    riskLevel: "high",
    runtimeStatus: "not_exposed",
    notes: "Tier A is never auto-sent by any tool or cron (ADR-016).",
  },
];

/**
 * Classify ALL real tools + append the forbidden-autonomous actions. Pure. The
 * returned list is the complete reflected boundary the summary builds counts and
 * consistency checks from.
 */
export function classifyAllTools(): ReflectedToolBoundaryItem[] {
  const real = reflectRealToolIds().map(classifyReflectedTool);
  return [...real, ...FORBIDDEN_AUTONOMOUS_ACTIONS];
}
