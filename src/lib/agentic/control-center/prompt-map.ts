// Agentic Control Center v0 — prompt map (static, read-only).
//
// First-level visibility into WHERE prompts and textual guards live. We surface
// paths + a short summary, NOT the full prompt bodies (kept out of the UI to
// avoid leaking the steering surface). No file reads at runtime.

import type { PromptMapEntry } from "./types";

const PROMPT_MAP: PromptMapEntry[] = [
  {
    id: "system-prompts",
    kind: "system",
    label: "Cockpit system prompts",
    paths: ["src/lib/llm/prompts.ts"],
    summary:
      "COCKPIT_DEFAULT_SYSTEM_PROMPT + COCKPIT_ADMIN_SYSTEM_PROMPT, role-aware register directives, educational read-only directive, outreach guidance. Server-side only; no client override.",
  },
  {
    id: "chat-modes",
    kind: "system",
    label: "Chat mode prompts",
    paths: ["src/lib/llm/chat-modes.ts", "src/lib/llm/admin-context.ts", "src/lib/llm/chat-context.ts"],
    summary:
      "Mode definitions (normal / admin / review-mode facilitator / product-workspace / scenario-lab) and the portfolio + admin context blocks spliced into the system prompt.",
  },
  {
    id: "batch-agent-prompts",
    kind: "agent",
    label: "Batch agent prompts",
    paths: [
      "src/lib/agents/scenario-narrative.ts",
      "src/lib/agents/mining-health.ts",
      "src/lib/agents/risk-explanation.ts",
      "src/lib/agents/investor-memo.ts",
      "src/lib/agents/system-prompts/methodology.ts",
      "src/lib/agents/system-prompts/disclaimers.ts",
    ],
    summary:
      "Per-agent instructions + shared methodology / disclaimer system blocks (DISCLAIMER_NOT_GUARANTEED, DISCLAIMER_PROJECTION). Structured-output schemas in src/lib/agents/schemas.ts.",
  },
  {
    id: "outreach-prompts",
    kind: "agent",
    label: "Outreach agent prompts",
    paths: [
      "src/lib/agents/outreach-writer.ts",
      "src/lib/agents/outreach-scorer.ts",
      "src/lib/agents/outreach-reply-handler.ts",
    ],
    summary:
      "Drafting / scoring / reply prompts. Forbidden-words guarded; every drafted message carries an unsubscribe link before any send.",
  },
  {
    id: "canvas-guidance",
    kind: "canvas",
    label: "Canvas / guidance prompts",
    paths: ["src/lib/canvas/guidance.ts", "src/lib/canvas/classify-canvas-intent.ts", "src/lib/canvas/outreach-turn.ts"],
    summary:
      "buildCanvasGuidanceBlock + canvas intent classification + outreach ask-fields turn. Steers the model to request missing fields without inventing data.",
  },
  {
    id: "review-prompts",
    kind: "agent",
    label: "Product review prompts",
    paths: ["src/lib/agents/system-prompts/review.ts"],
    summary:
      "buildFacilitatorPrompt for @hearst/review-mode — educational facilitation only, no navigation, no write tools.",
  },
  {
    id: "compliance-guards",
    kind: "guard",
    label: "Textual compliance guards",
    paths: [
      "src/lib/llm/output-guard.ts",
      "src/lib/agents/forbidden-words.ts",
      "src/lib/agents/apy-range.ts",
    ],
    summary:
      "chatOutputViolation + forbidden-words list + APY-range checker. Output-side, runs on every human-facing surface; single-point APY + forbidden words hard-block.",
  },
  {
    id: "router-rules",
    kind: "guard",
    label: "Deterministic router rules",
    paths: ["src/lib/agentic/intent-router-rules.ts", "src/lib/llm/prompts.ts"],
    summary:
      "Regex rule sets (DANGEROUS / EDUCATION / OUTREACH / PRODUCT_VAULT / REPORTING / SEND_SOURCE) + the educational read-only directive builder.",
  },
];

export function getPromptMap(): PromptMapEntry[] {
  return PROMPT_MAP;
}
