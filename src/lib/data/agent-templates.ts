import "server-only";

import type { AgentTemplate } from "@prisma/client";

import { prisma } from "@/lib/db";

export type { AgentTemplate };

// Client-safe enums live in agent-template-constants.ts (no server-only / no
// Prisma) so client components can import them; re-export here for server callers.
export {
  BASE_AGENTS,
  TONES,
  LANGUAGES,
  VERBOSITIES,
  type BaseAgent,
} from "@/lib/agents/agent-template-constants";

export interface AgentTemplateRow extends AgentTemplate {
  /** How many customers currently use this template. */
  usageCount: number;
}

/** Lists templates (active first) with their per-template usage count. */
export async function loadAgentTemplates(): Promise<AgentTemplateRow[]> {
  const templates = await prisma.agentTemplate.findMany({
    orderBy: [{ archived: "asc" }, { updatedAt: "desc" }],
  });

  if (templates.length === 0) return [];

  const counts = await prisma.userAgentProfile.groupBy({
    by: ["templateId"],
    where: { templateId: { in: templates.map((t) => t.id) } },
    _count: { _all: true },
  });
  const byId = new Map(counts.map((c) => [c.templateId, c._count._all]));

  return templates.map((t) => ({ ...t, usageCount: byId.get(t.id) ?? 0 }));
}

export async function loadAgentTemplate(
  id: string,
): Promise<AgentTemplate | null> {
  return prisma.agentTemplate.findUnique({ where: { id } });
}

/** Active templates only — used to populate the per-customer assignment select. */
export async function loadActiveTemplates(): Promise<AgentTemplate[]> {
  return prisma.agentTemplate.findMany({
    where: { archived: false },
    orderBy: { label: "asc" },
  });
}
