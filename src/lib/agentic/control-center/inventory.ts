// Agentic Control Center v0 — agent / logic inventory (static, read-only).
//
// Each entry points at the real source-of-truth file(s). This is a VISIBILITY
// registry: it lists what exists, where its prompt lives, what it may write, and
// whether a human gate protects it. No DB, no LLM, no I/O.
//
// To add an agent: append an AgenticInventoryItem with accurate paths + flags.

import type { AgenticInventoryItem } from "./types";

const INVENTORY: AgenticInventoryItem[] = [
  {
    id: "master-agent-chat",
    name: "Master Agent / Cockpit Chat",
    domain: "chat",
    paths: [
      "src/app/api/cockpit-chat/route.ts",
      "src/lib/llm/chat-agent.ts",
    ],
    type: "chat",
    status: "active",
    writesAllowed: false,
    humanGateRequired: true,
    riskLevel: "high",
    notes:
      "Single conversational engine (LP Master Agent + admin copilot + review-mode), ADR-017. Read tools + draft-only write tools; every write is HITL two-step token. No financial/custodial action. Kill-switch CHAT_MASTER_AGENT.",
  },
  {
    id: "intent-router",
    name: "Deterministic Intent Router v2",
    domain: "routing",
    paths: [
      "src/lib/agentic/intent-router.ts",
      "src/lib/agentic/intent-router-rules.ts",
      "src/lib/agentic/intent-router-negation.ts",
    ],
    type: "router",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "medium",
    notes:
      "Classifies the message BEFORE the LLM (nav / education / dangerous-refusal / negation active; outreach / product / reporting / readiness shadow). Invariant: prohibited never maps to an allow_* action.",
  },
  {
    id: "scenario-narrative",
    name: "Scenario Narrative Agent",
    domain: "scenario",
    paths: ["src/lib/agents/scenario-narrative.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "Turns pure scenario-engine output into plain-language narrative. Structured JSON only; APY always a range; cites assumptions + not-guaranteed.",
  },
  {
    id: "mining-health",
    name: "Mining Health Agent",
    domain: "scenario",
    paths: ["src/lib/agents/mining-health.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "Summarizes mining-fleet health / hashrate signals. Structured JSON only, provenance-aware.",
  },
  {
    id: "risk-explanation",
    name: "Risk Explanation Agent",
    domain: "scenario",
    paths: ["src/lib/agents/risk-explanation.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "Explains risk posture + assumptions with disclaimers. No forbidden words, no single-point APY.",
  },
  {
    id: "investor-memo",
    name: "Investor Memo Agent",
    domain: "reporting",
    paths: ["src/lib/agents/investor-memo.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "Drafts a structured investor memo from vault state + proofs. Output is a draft surfaced to admin, not auto-published.",
  },
  {
    id: "outreach-scorer",
    name: "Outreach Scorer",
    domain: "outreach",
    paths: ["src/lib/agents/outreach-scorer.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "Rates prospect fit [0,100] against the ICP. Pure scoring, no sends, no persisted side effect by itself.",
  },
  {
    id: "outreach-writer",
    name: "Outreach Writer",
    domain: "outreach",
    paths: ["src/lib/agents/outreach-writer.ts"],
    type: "batch-agent",
    status: "gated",
    writesAllowed: false,
    humanGateRequired: true,
    riskLevel: "medium",
    notes:
      "Drafts cold-outreach / newsletter emails. Draft-only; actual sending is a separate HITL-gated send run (ADR-016), never Tier A auto-sent.",
  },
  {
    id: "outreach-reply-handler",
    name: "Outreach Reply Handler",
    domain: "outreach",
    paths: ["src/lib/agents/outreach-reply-handler.ts"],
    type: "batch-agent",
    status: "gated",
    writesAllowed: false,
    humanGateRequired: true,
    riskLevel: "medium",
    notes:
      "Handles inbound prospect replies. Proposes a draft reply; dispatch stays behind the send policy + autonomy dial.",
  },
  {
    id: "memory-distill",
    name: "Memory Distill Worker",
    domain: "memory",
    paths: [
      "src/lib/agents/memory-distill.ts",
      "src/lib/agents/memory.ts",
    ],
    type: "worker",
    status: "active",
    writesAllowed: true,
    humanGateRequired: false,
    riskLevel: "medium",
    notes:
      "Auto-distills cockpit conversations into durable AgentMemory facts (source: chat-distill). Best-effort, forbidden words dropped. Internal note write only — no financial/external effect.",
  },
  {
    id: "product-review",
    name: "Product Review Facilitator",
    domain: "product",
    paths: [
      "src/app/api/admin/review-document/route.ts",
      "src/lib/agents/system-prompts/review.ts",
    ],
    type: "chat",
    status: "read-only",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "@hearst/review-mode facilitator. Educational/read-only: must NOT navigate or execute write tools. Generates a review document (MD+JSON).",
  },
  {
    id: "vault-readiness",
    name: "Vault Readiness / Deploy Safety",
    domain: "vault",
    paths: [
      "src/app/admin/vaults/actions.ts",
      "src/app/admin/vaults/schema.ts",
    ],
    type: "worker",
    status: "gated",
    writesAllowed: true,
    humanGateRequired: true,
    riskLevel: "high",
    notes:
      "markAsLive / promote are admin server actions (requireAdmin + rate-limit + draft→review→deployed→live state machine + blueprint completeness + approval quorum). NOT a chat tool. Mainnet deploy gated on Spearbit audit (ADR-006).",
  },
  {
    id: "compliance-guards",
    name: "Compliance Guards (APY range + forbidden words + output guard)",
    domain: "compliance",
    paths: [
      "src/lib/agents/apy-range.ts",
      "src/lib/agents/forbidden-words.ts",
      "src/lib/llm/output-guard.ts",
    ],
    type: "guard",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "medium",
    notes:
      "Output-side guard on every human-facing surface: forbidden words (guarantee/promise/…) + APY always a range (single-point blocked, source-attribution exemption). Owned by the Router/Guard agent.",
  },
  {
    id: "canvas-composers",
    name: "Canvas Composers",
    domain: "canvas",
    paths: [
      "src/lib/canvas/compose.ts",
      "src/lib/canvas/emit.ts",
      "src/lib/canvas/registry.ts",
    ],
    type: "canvas",
    status: "active",
    writesAllowed: false,
    humanGateRequired: true,
    riskLevel: "medium",
    notes:
      "Compose / emit the agent canvas workspace ([[canvas:id]] marker). Opens a pre-filled admin page; actions inside are HITL two-step token. create_vault_draft stays draft-only.",
  },
  {
    id: "tool-registry",
    name: "Admin Tool Registry",
    domain: "tools",
    paths: [
      "src/lib/llm/tools/registry.ts",
      "src/lib/llm/tools/confirmations.ts",
      "src/lib/llm/tools/policy.ts",
    ],
    type: "tool",
    status: "active",
    writesAllowed: true,
    humanGateRequired: true,
    riskLevel: "high",
    notes:
      "Read tools (low risk, no confirmation) + write tools (HITL confirmation token, admin-only chat mode). Execution entry point: src/app/api/admin/chat-tools/route.ts (logs AdminToolRun).",
  },
];

export function getAgenticInventory(): AgenticInventoryItem[] {
  return INVENTORY;
}
