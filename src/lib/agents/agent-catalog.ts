/**
 * Static catalog classifying every base (code) agent in the admin console.
 *
 * Client-safe & pure: no `server-only`, no Prisma, no fs — importable by the
 * server-component Agents page AND by any client component that needs to render
 * the classification. Built from the single-source maps in
 * `agent-template-constants.ts` (labels, scope) so there is no second copy of
 * the agent list to drift.
 */

import {
  BASE_AGENTS,
  BASE_AGENT_LABELS,
  BASE_AGENT_SCOPE,
  SCOPE_LABELS,
  type AgentScope,
  type BaseAgent,
} from "@/lib/agents/agent-template-constants";

/**
 * Stable icon key per agent — resolved to a lucide component at the render
 * site (kept as a string here so this module stays a pure, client-safe data
 * source with no component imports).
 */
export type AgentIconKey =
  | "chat"
  | "narrative"
  | "memo"
  | "mining"
  | "risk"
  | "outreach"
  | "memory"
  | "review";

export interface AgentCatalogEntry {
  baseAgent: BaseAgent;
  /** Human label, from BASE_AGENT_LABELS. */
  label: string;
  /** Where the agent runs, from BASE_AGENT_SCOPE. */
  scope: AgentScope;
  /** Display label for the scope, from SCOPE_LABELS. */
  scopeLabel: string;
  /** One-line description of what the agent produces. */
  description: string;
  /** Short surface label — where this agent shows up in the product. */
  surface: string;
  /** Icon key — mapped to a lucide component at the render site. */
  icon: AgentIconKey;
}

/** Per-agent description + surface + icon — the only catalog-specific copy. */
const AGENT_DETAILS: Record<
  BaseAgent,
  { description: string; surface: string; icon: AgentIconKey }
> = {
  "cockpit-chat": {
    description:
      "Conversational Master Agent for LPs — read-only navigation, no write tools, human-in-the-loop.",
    surface: "Investor cockpit",
    icon: "chat",
  },
  "scenario-narrative": {
    description:
      "Turns scenario-engine output into a plain-language narrative (PTAI, APY as a range).",
    surface: "Investor cockpit",
    icon: "narrative",
  },
  "investor-memo": {
    description:
      "Drafts the structured investor memo from vault state, allocations and proofs.",
    surface: "Monthly batch",
    icon: "memo",
  },
  "mining-health": {
    description:
      "Summarises mining-fleet health and hashrate signals for the period.",
    surface: "Monthly batch",
    icon: "mining",
  },
  "risk-explanation": {
    description:
      "Explains risk posture and assumptions behind a projection, with disclaimers.",
    surface: "Investor cockpit",
    icon: "risk",
  },
  "email-outreach": {
    description:
      "Drafts cold-outreach and newsletter emails — Typeform qualification CTA and memory-based personalisation.",
    surface: "Admin outreach platform",
    icon: "outreach",
  },
  "memory-distill": {
    description:
      "Distills LP cockpit conversations into durable memory notes (OpenAI) used for per-account personalisation.",
    surface: "Admin customer ops",
    icon: "memory",
  },
  "product-review": {
    description:
      "Facilitates the internal product-review chat and generates the structured review document (Markdown + JSON).",
    surface: "Admin review mode",
    icon: "review",
  },
};

/** Every base agent, classified by scope, label, surface and description. */
export const AGENT_CATALOG: readonly AgentCatalogEntry[] = BASE_AGENTS.map(
  (baseAgent): AgentCatalogEntry => {
    const scope = BASE_AGENT_SCOPE[baseAgent];
    const details = AGENT_DETAILS[baseAgent];
    return {
      baseAgent,
      label: BASE_AGENT_LABELS[baseAgent],
      scope,
      scopeLabel: SCOPE_LABELS[scope],
      description: details.description,
      surface: details.surface,
      icon: details.icon,
    };
  },
);

/** Display order for the grouped catalog sections. */
export const AGENT_SCOPE_ORDER: readonly AgentScope[] = [
  "batch",
  "chat",
  "platform",
];

/** Group the catalog by scope, in canonical display order, dropping empty groups. */
export function groupCatalogByScope(): {
  scope: AgentScope;
  scopeLabel: string;
  entries: AgentCatalogEntry[];
}[] {
  return AGENT_SCOPE_ORDER.map((scope) => ({
    scope,
    scopeLabel: SCOPE_LABELS[scope],
    entries: AGENT_CATALOG.filter((entry) => entry.scope === scope),
  })).filter((group) => group.entries.length > 0);
}
