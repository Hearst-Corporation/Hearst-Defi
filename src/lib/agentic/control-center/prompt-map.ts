// Agentic Control Center — prompt map (static, read-only).
//
// First-level visibility into WHERE prompts and textual guards live. We surface
// paths + a short summary, NOT the full prompt bodies (kept out of the UI to
// avoid leaking the steering surface). No file reads at runtime. Prompts are
// NOT editable from this UI — editableInUi is always false.

import type { PromptMapEntry } from "./types";

const PROMPT_MAP: PromptMapEntry[] = [
  {
    id: "system-prompts",
    kind: "system",
    label: "Cockpit system prompts",
    domain: "chat",
    paths: ["src/lib/llm/prompts.ts"],
    editableInUi: false,
    summary:
      "COCKPIT_DEFAULT_SYSTEM_PROMPT + COCKPIT_ADMIN_SYSTEM_PROMPT, role-aware register, buildEducationalReadOnlyDirective. Server-side only; no client override.",
  },
  {
    id: "chat-modes",
    kind: "system",
    label: "Chat mode / context prompts",
    domain: "chat",
    paths: [
      "src/lib/llm/chat-modes.ts",
      "src/lib/llm/admin-context.ts",
      "src/lib/llm/chat-context.ts",
    ],
    editableInUi: false,
    summary:
      "Mode definitions (normal / admin / review-mode / product-workspace / scenario-lab) + portfolio + admin context blocks spliced into the system prompt.",
  },
  {
    id: "batch-agent-prompts",
    kind: "agent",
    label: "Batch agent prompts",
    domain: "scenario",
    paths: [
      "src/lib/agents/scenario-narrative.ts",
      "src/lib/agents/mining-health.ts",
      "src/lib/agents/risk-explanation.ts",
      "src/lib/agents/investor-memo.ts",
    ],
    editableInUi: false,
    summary:
      "Per-agent instructions for the 4 batch agents. Structured-output schemas in src/lib/agents/schemas.ts.",
  },
  {
    id: "methodology-disclaimers",
    kind: "methodology",
    label: "Methodology + disclaimers",
    domain: "compliance",
    paths: [
      "src/lib/agents/system-prompts/methodology.ts",
      "src/lib/agents/system-prompts/disclaimers.ts",
    ],
    editableInUi: false,
    summary:
      "Shared methodology version block + DISCLAIMER_NOT_GUARANTEED / DISCLAIMER_PROJECTION injected into agent prompts.",
  },
  {
    id: "outreach-prompts",
    kind: "agent",
    label: "Outreach agent prompts",
    domain: "outreach",
    paths: [
      "src/lib/agents/outreach-writer.ts",
      "src/lib/agents/outreach-scorer.ts",
      "src/lib/agents/outreach-reply-handler.ts",
    ],
    editableInUi: false,
    summary:
      "Drafting / scoring / reply prompts. Forbidden-words guarded; every drafted message carries an unsubscribe link before any send.",
  },
  {
    id: "canvas-guidance",
    kind: "canvas",
    label: "Canvas / guidance prompts",
    domain: "canvas",
    paths: [
      "src/lib/canvas/guidance.ts",
      "src/lib/canvas/classify-canvas-intent.ts",
      "src/lib/canvas/outreach-turn.ts",
    ],
    editableInUi: false,
    summary:
      "buildCanvasGuidanceBlock + canvas intent classification + outreach ask-fields turn. Steers the model to request missing fields without inventing data.",
  },
  {
    id: "review-prompts",
    kind: "agent",
    label: "Product review prompts",
    domain: "product",
    paths: ["src/lib/agents/system-prompts/review.ts"],
    editableInUi: false,
    summary:
      "buildFacilitatorPrompt for @hearst/review-mode — educational facilitation only, no navigation, no write tools.",
  },
  {
    id: "memory-distill-prompt",
    kind: "agent",
    label: "Memory distill prompt",
    domain: "memory",
    paths: ["src/lib/agents/memory-distill.ts"],
    editableInUi: false,
    summary:
      "Distillation instruction turning a conversation into durable AgentMemory facts; forbidden words dropped from results.",
  },
  {
    id: "compliance-guards",
    kind: "guard",
    label: "Textual compliance guards",
    domain: "compliance",
    paths: [
      "src/lib/llm/output-guard.ts",
      "src/lib/agents/forbidden-words.ts",
      "src/lib/agents/apy-range.ts",
    ],
    editableInUi: false,
    summary:
      "chatOutputViolation + forbidden-words list + APY-range checker. Output-side, every human-facing surface; single-point APY + forbidden words hard-block.",
  },
  {
    id: "router-rules",
    kind: "guard",
    label: "Deterministic router rules",
    domain: "routing",
    paths: ["src/lib/agentic/intent-router-rules.ts", "src/lib/llm/prompts.ts"],
    editableInUi: false,
    summary:
      "Regex rule sets (DANGEROUS / EDUCATION / OUTREACH / PRODUCT_VAULT / REPORTING / SEND_SOURCE) + the educational read-only directive builder.",
  },
];

export function getPromptMap(): PromptMapEntry[] {
  return PROMPT_MAP;
}
