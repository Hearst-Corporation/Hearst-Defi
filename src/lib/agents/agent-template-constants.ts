/**
 * Client-safe constants for agent templates.
 *
 * Deliberately split from `src/lib/data/agent-templates.ts` (which is
 * `server-only` and imports Prisma) so client components — the template form,
 * the assign form — can import these enums without pulling Prisma / node:fs
 * into the browser bundle. Mirrors the roadmap.ts / roadmap-types.ts split.
 */

/** The code agents a template may specialise (mirror user-context AgentName). */
export const BASE_AGENTS = [
  "cockpit-chat",
  "scenario-narrative",
  "investor-memo",
  "mining-health",
  "risk-explanation",
  "email-outreach",
  "memory-distill",
  "product-review",
] as const;

export type BaseAgent = (typeof BASE_AGENTS)[number];

/**
 * Human labels for each base agent (shown in the agent console). Single source
 * of truth so both the list and the template form import the same map.
 */
export const BASE_AGENT_LABELS: Record<BaseAgent, string> = {
  "cockpit-chat": "Cockpit chat (Master Agent)",
  "scenario-narrative": "Scenario Narrative",
  "investor-memo": "Investor Memo",
  "mining-health": "Mining Health",
  "risk-explanation": "Risk Explanation",
  "email-outreach": "Email Outreach",
  "memory-distill": "Memory Distillation",
  "product-review": "Product Review (Facilitator)",
};

/**
 * Where each agent runs — used to classify them in the admin console.
 *   "batch"    = scheduled/structured report agents.
 *   "chat"     = the conversational cockpit Master Agent.
 *   "platform" = platform-ops agents (outreach/newsletters) the admin drives
 *                directly — not investor-facing.
 */
export type AgentScope = "batch" | "chat" | "platform";

export const BASE_AGENT_SCOPE: Record<BaseAgent, AgentScope> = {
  "cockpit-chat": "chat",
  "scenario-narrative": "batch",
  "investor-memo": "batch",
  "mining-health": "batch",
  "risk-explanation": "batch",
  "email-outreach": "platform",
  "memory-distill": "platform",
  "product-review": "platform",
};

export const SCOPE_LABELS: Record<AgentScope, string> = {
  batch: "Batch",
  chat: "Chat",
  platform: "Platform",
};

export const TONES = ["concise", "detailed", "technical"] as const;
export const LANGUAGES = ["fr", "en"] as const;
export const VERBOSITIES = ["low", "medium", "high"] as const;
