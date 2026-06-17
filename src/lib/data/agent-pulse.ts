import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  BASE_AGENTS,
  BASE_AGENT_LABELS,
  type BaseAgent,
} from "@/lib/agents/agent-template-constants";

/**
 * Live "pulse" of each base agent, derived from its most recent LlmRun.
 *
 * Read-only and honest: an agent with no run is `idle` (never faked as live),
 * a recent successful run is `active`, a recent failure is `failed`. Feeds the
 * animated dice canvas on /admin/agents so the visual reflects real activity.
 */

export type AgentPulseState = "active" | "idle" | "failed";

export interface AgentPulse {
  agent: BaseAgent;
  label: string;
  state: AgentPulseState;
  /** ISO timestamp of the last run, or null when the agent never ran. */
  lastRunIso: string | null;
  /** Runs in the recent window (drives animation intensity). */
  recentRuns: number;
}

/** A run newer than this counts the agent as "active" (recently working). */
const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // 10 min
/** Window for the recent-run count (animation intensity). */
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h

/**
 * One pulse per base agent. A single grouped query gets each agent's recent
 * runs; we reduce to the latest status + a recent count. Best-effort: on a DB
 * error every agent degrades to `idle` (the visual still renders, honestly
 * showing nothing is live rather than crashing the page).
 */
export async function loadAgentPulses(now: number = Date.now()): Promise<AgentPulse[]> {
  const recentSince = new Date(now - RECENT_WINDOW_MS);
  try {
    const rows = await prisma.llmRun.findMany({
      where: { createdAt: { gte: recentSince } },
      select: { agentName: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const byAgent = new Map<
      string,
      { latest: { status: string; createdAt: Date } | null; count: number }
    >();
    for (const row of rows) {
      const entry = byAgent.get(row.agentName) ?? { latest: null, count: 0 };
      if (!entry.latest) entry.latest = { status: row.status, createdAt: row.createdAt };
      entry.count += 1;
      byAgent.set(row.agentName, entry);
    }

    return BASE_AGENTS.map((agent) => {
      const entry = byAgent.get(agent);
      const latest = entry?.latest ?? null;
      const lastRunMs = latest ? latest.createdAt.getTime() : null;
      let state: AgentPulseState = "idle";
      if (latest) {
        if (latest.status === "failed" || latest.status === "timeout") {
          state = "failed";
        } else if (lastRunMs !== null && now - lastRunMs <= ACTIVE_WINDOW_MS) {
          state = "active";
        }
      }
      return {
        agent,
        label: BASE_AGENT_LABELS[agent],
        state,
        lastRunIso: latest ? latest.createdAt.toISOString() : null,
        recentRuns: entry?.count ?? 0,
      };
    });
  } catch (err) {
    logger.warn(
      "agent pulse load failed — degrading all agents to idle",
      {},
      err instanceof Error ? err : undefined,
    );
    return BASE_AGENTS.map((agent) => ({
      agent,
      label: BASE_AGENT_LABELS[agent],
      state: "idle" as const,
      lastRunIso: null,
      recentRuns: 0,
    }));
  }
}
