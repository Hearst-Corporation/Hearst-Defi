// Agentic Control Center — agent / logic inventory (static, read-only).
//
// Each entry points at the real source-of-truth file(s). This is a VISIBILITY
// registry: it lists what exists, where its prompt lives, what it may write, and
// whether a human gate protects it. No DB, no LLM, no I/O.
//
// To add an agent: append an AgenticInventoryItem with accurate paths + flags.
// `writesAllowed` = "the underlying logic touches a persisted row" (e.g. a batch
// agent that writes an LlmRun + its structured output, or a draft tool). It does
// NOT mean the chat can trigger it autonomously — `humanGateRequired` captures
// that, and the Human Gates section is the authoritative "never autonomous" list.

import type { AgenticInventoryItem } from "./types";

const INVENTORY: AgenticInventoryItem[] = [
  {
    id: "master-agent-chat",
    name: "Master Agent / Cockpit Chat",
    domain: "chat",
    paths: ["src/app/api/cockpit-chat/route.ts", "src/lib/llm/chat-agent.ts"],
    promptLocations: ["src/lib/llm/prompts.ts"],
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
    name: "Deterministic Intent Router",
    domain: "routing",
    paths: [
      "src/lib/agentic/intent-router.ts",
      "src/lib/agentic/intent-router-rules.ts",
      "src/lib/agentic/intent-router-negation.ts",
      "src/lib/agentic/intent-router-normalize.ts",
      "src/lib/agentic/intent-router-types.ts",
    ],
    type: "router",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "Classifies the message BEFORE the LLM (nav / education / dangerous-refusal / negation active). Pure logic, no I/O. Invariant: prohibited never maps to an allow_* action. Non-shadow (AGENTIC_ROUTER_SHADOW removed).",
  },
  {
    id: "guard-forbidden-words",
    name: "Compliance Forbidden Words Guard",
    domain: "compliance",
    paths: ["src/lib/agents/forbidden-words.ts"],
    promptLocations: ["src/lib/agents/forbidden-words.ts"],
    type: "guard",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "critical",
    notes:
      "Canonical FR∪EN forbidden-words matcher (guarantee/promise/certain/will deliver/risk-free). Single source of truth, reused by chat + batch agents + validators. No intent exemption.",
  },
  {
    id: "guard-apy-range",
    name: "APY Range Guard",
    domain: "compliance",
    paths: ["src/lib/agents/apy-range.ts"],
    type: "guard",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "critical",
    notes:
      "APY-always-a-range detector; single-point headline blocked. Exemptions are universal (numeric range, per-source attribution) — not intent-based. Shared by output-guard + batch-agent validators.",
  },
  {
    id: "guard-output",
    name: "Output Guard (stream compliance)",
    domain: "compliance",
    paths: ["src/lib/llm/output-guard.ts"],
    type: "guard",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "critical",
    notes:
      "chatOutputViolation(): real-time stream guard blocking forbidden words + single-point APY before token emission. Look-back buffer + sentinel abort. No intent parameter — cannot be relaxed per-intent.",
  },
  {
    id: "canvas-registry",
    name: "Canvas Registry",
    domain: "canvas",
    paths: ["src/lib/canvas/registry.ts"],
    type: "registry",
    status: "active",
    writesAllowed: false,
    humanGateRequired: true,
    riskLevel: "medium",
    notes:
      "Canvas workspace definitions: id + audience + title + nav key + write-tool allowlist + seed objective. Vitest-pinned invariants. Opens a pre-filled admin page; actions inside are HITL token.",
  },
  {
    id: "canvas-composer",
    name: "Canvas Composer / Emit",
    domain: "canvas",
    paths: ["src/lib/canvas/compose.ts", "src/lib/canvas/emit.ts"],
    promptLocations: ["src/lib/canvas/guidance.ts"],
    type: "canvas",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "medium",
    notes:
      "Server-side deterministic canvas state composer (no LLM free-authoring); wraps the stream with the compliance check; emit interleaves canvas_state events. create_vault_draft stays draft-only.",
  },
  {
    id: "tool-registry",
    name: "Admin Tool Registry",
    domain: "tools",
    paths: [
      "src/lib/llm/tools/registry.ts",
      "src/lib/llm/tools/types.ts",
      "src/lib/llm/tools/policy.ts",
    ],
    type: "registry",
    status: "active",
    writesAllowed: true,
    humanGateRequired: true,
    riskLevel: "high",
    notes:
      "11 read tools (low risk, no confirmation) + 6 write tools (HITL confirmation token, admin-only chat mode + profile). getAllowedAdminWriteTools + isAdminWriteToolAllowed are the belt-and-suspenders gate. Execution entry: src/app/api/admin/chat-tools/route.ts (logs AdminToolRun).",
  },
  {
    id: "hitl-confirmations",
    name: "HITL Confirmations",
    domain: "tools",
    paths: ["src/lib/llm/tools/confirmations.ts"],
    type: "validator",
    status: "active",
    writesAllowed: true,
    humanGateRequired: true,
    riskLevel: "high",
    notes:
      "Two-step token: createWriteConfirmation (UUID + SHA-256 canonical payload hash + TTL) → consumeWriteConfirmation (userId + toolId + payloadHash match, single-use usedAt). Write tools never auto-execute.",
  },
  {
    id: "outreach-scorer",
    name: "Outreach Scorer",
    domain: "outreach",
    paths: ["src/lib/agents/outreach-scorer.ts"],
    promptLocations: ["src/lib/agents/outreach-scorer.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: false,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "Rates prospect ICP fit [0,100] + 2–4 rationale bullets. JSON-only, hard score clamp. No sends, no persisted side effect by itself.",
  },
  {
    id: "outreach-writer",
    name: "Outreach Writer",
    domain: "outreach",
    paths: ["src/lib/agents/outreach-writer.ts"],
    promptLocations: ["src/lib/agents/outreach-writer.ts"],
    type: "batch-agent",
    status: "gated",
    writesAllowed: true,
    humanGateRequired: true,
    riskLevel: "medium",
    notes:
      "Drafts cold-outreach / newsletter emails (subject + body); asserts no forbidden words + no single-point APY; CTA ensured. Draft-only; sending is a separate HITL-gated send run (ADR-016), Tier A never auto-sent.",
  },
  {
    id: "outreach-reply-handler",
    name: "Outreach Reply Handler",
    domain: "outreach",
    paths: ["src/lib/agents/outreach-reply-handler.ts"],
    promptLocations: ["src/lib/agents/outreach-reply-handler.ts"],
    type: "batch-agent",
    status: "gated",
    writesAllowed: false,
    humanGateRequired: true,
    riskLevel: "low",
    notes:
      "Classifies inbound replies (interested/not_now/question/unsubscribe/bounce/auto_reply/other) and recommends next action. Dispatch stays behind the send policy + autonomy dial.",
  },
  {
    id: "scenario-narrative",
    name: "Scenario Narrative",
    domain: "scenario",
    paths: ["src/lib/agents/scenario-narrative.ts"],
    promptLocations: ["src/lib/agents/scenario-narrative.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: true,
    humanGateRequired: false,
    riskLevel: "medium",
    notes:
      "Turns pure scenario-engine output into plain-language narrative (structured JSON). Validators: APY range + forbidden words + assumption citations. Persists an LlmRun. Output is a draft surfaced to admin.",
  },
  {
    id: "investor-memo",
    name: "Investor Memo",
    domain: "reporting",
    paths: ["src/lib/agents/investor-memo.ts"],
    promptLocations: ["src/lib/agents/investor-memo.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: true,
    humanGateRequired: false,
    riskLevel: "medium",
    notes:
      "Drafts a structured investor memo from vault state + proofs (monthly cron). Same validators as scenario-narrative. Draft surfaced to admin, not auto-published.",
  },
  {
    id: "mining-health",
    name: "Mining Health",
    domain: "scenario",
    paths: ["src/lib/agents/mining-health.ts"],
    promptLocations: ["src/lib/agents/mining-health.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: true,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "Summarizes mining-fleet health / hashrate signals (daily cron, structured JSON). Provenance-aware; APY range + forbidden words + assumption cites.",
  },
  {
    id: "risk-explanation",
    name: "Risk Explanation",
    domain: "scenario",
    paths: ["src/lib/agents/risk-explanation.ts"],
    promptLocations: ["src/lib/agents/risk-explanation.ts"],
    type: "batch-agent",
    status: "active",
    writesAllowed: true,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "Explains risk posture + assumptions with disclaimers (daily + rebalancing triggers, structured JSON). No forbidden words, no single-point APY.",
  },
  {
    id: "memory-distill",
    name: "Memory Distill",
    domain: "memory",
    paths: ["src/lib/agents/memory-distill.ts", "src/lib/agents/memory.ts"],
    promptLocations: ["src/lib/agents/memory-distill.ts"],
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
    name: "Product Review",
    domain: "product",
    paths: [
      "src/app/api/admin/review-document/route.ts",
      "src/lib/agents/system-prompts/review.ts",
    ],
    promptLocations: ["src/lib/agents/system-prompts/review.ts"],
    type: "server-action",
    status: "read-only",
    writesAllowed: true,
    humanGateRequired: false,
    riskLevel: "low",
    notes:
      "@hearst/review-mode facilitator. Educational/read-only chat: must NOT navigate or execute write tools. Generates a review document (MD+JSON) for admin.",
  },
  {
    id: "vault-admin-state-machine",
    name: "Vault Admin State Machine",
    domain: "vault",
    paths: ["src/app/admin/vaults/actions.ts", "src/app/admin/vaults/schema.ts"],
    type: "server-action",
    status: "gated",
    writesAllowed: true,
    humanGateRequired: true,
    riskLevel: "critical",
    notes:
      "draft → review → deployed → live state machine (requireAdmin + rate-limit + assertTransition). Schema enforces APY range + forbidden words + allocation sum + signer quorum. NOT a chat tool.",
  },
  {
    id: "vault-readiness-deploy-safety",
    name: "Vault Readiness / Deploy Safety",
    domain: "vault",
    paths: ["src/app/admin/vaults/actions.ts", "src/lib/vaults/blueprint.ts"],
    type: "server-action",
    status: "gated",
    writesAllowed: true,
    humanGateRequired: true,
    riskLevel: "critical",
    notes:
      "markAsLive runs evaluateDeploymentLiveGate (blueprint completeness + approval quorum) as the final deploy-safety check, inline in the deployed→live transition. Not a distinct file; not reachable from chat. Mainnet gated on Spearbit audit (ADR-006).",
  },
  {
    id: "product-workspace",
    name: "Product Workspace",
    domain: "product",
    paths: [
      "src/app/admin/product-workspace/page.tsx",
      "src/lib/llm/product-workspace-intent.ts",
      "src/lib/product-workspace/draft.ts",
    ],
    promptLocations: ["src/lib/llm/product-workspace-intent.ts"],
    type: "canvas",
    status: "gated",
    writesAllowed: true,
    humanGateRequired: true,
    riskLevel: "high",
    notes:
      "Framing/doc-only workspace: intent classifier (create/frame/simulate/mixed) routes to creation or scenario-lab and persists a brief. Honest doc-only scope; vault creation stays draft + HITL.",
  },
  {
    id: "observability-runs",
    name: "Admin Tool Runs / LLM Runs Observability",
    domain: "observability",
    paths: ["src/lib/llm/client.ts", "src/lib/data/agent-graph.ts"],
    type: "observability",
    status: "active",
    writesAllowed: true,
    humanGateRequired: false,
    riskLevel: "medium",
    notes:
      "LlmRun (via callLlm) + AdminToolRun (via chat-tools route) trace tables; agent-graph.ts provides the live orchestration views. Writes are audit/telemetry rows only. This console reads NONE of it at runtime (static v0.1).",
  },
];

export function getAgenticInventory(): AgenticInventoryItem[] {
  return INVENTORY;
}
