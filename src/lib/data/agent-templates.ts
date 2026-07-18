import "server-only";

import type { AgentTemplate } from "@prisma/client";

import { prisma } from "@/lib/db";

export type { AgentTemplate };

/** Active templates only — used to populate the per-customer assignment select. */
export async function loadActiveTemplates(): Promise<AgentTemplate[]> {
  return prisma.agentTemplate.findMany({
    where: { archived: false },
    orderBy: { label: "asc" },
  });
}
