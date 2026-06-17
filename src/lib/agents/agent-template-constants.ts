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
] as const;

export type BaseAgent = (typeof BASE_AGENTS)[number];

export const TONES = ["concise", "detailed", "technical"] as const;
export const LANGUAGES = ["fr", "en"] as const;
export const VERBOSITIES = ["low", "medium", "high"] as const;
