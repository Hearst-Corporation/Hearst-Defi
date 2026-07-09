import "server-only";

import { prisma } from "@/lib/db";

/**
 * Recent LLM run history for the Model Bench page.
 *
 * Reads the shared `LlmRun` table — the same rows every product agent + the
 * cockpit chat write on each call (see src/lib/llm/client.ts). This is a
 * READ-ONLY window on real runtime traffic: per-agent counts, latency, cost,
 * error rate. It does NOT include bench fan-outs (those go straight to the
 * providers and are traced in LangSmith, not persisted here).
 */

export interface RunHistoryRow {
  id: string;
  createdAt: string;
  agentName: string;
  model: string;
  status: string;
  latencyMs: number | null;
  costUsd: number | null;
  totalTokens: number | null;
  errorType: string | null;
}

export interface AgentRollup {
  agentName: string;
  runs: number;
  successRate: number;
  avgLatencyMs: number | null;
  totalCostUsd: number;
}

export interface BenchHistory {
  recent: RunHistoryRow[];
  rollups: AgentRollup[];
  totalRuns: number;
}

export async function loadBenchHistory(limit = 40): Promise<BenchHistory> {
  const [recent, grouped, totalRuns] = await Promise.all([
    prisma.llmRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        agentName: true,
        model: true,
        status: true,
        latencyMs: true,
        costUsd: true,
        inputTokens: true,
        outputTokens: true,
        errorType: true,
      },
    }),
    prisma.llmRun.groupBy({
      by: ["agentName"],
      _count: { _all: true },
      _sum: { costUsd: true, latencyMs: true },
      orderBy: { _count: { agentName: "desc" } },
      take: 12,
    }),
    prisma.llmRun.count(),
  ]);

  // Success counts per agent (a second cheap grouped query keeps rollups honest).
  const successCounts = await prisma.llmRun.groupBy({
    by: ["agentName"],
    where: { status: "success" },
    _count: { _all: true },
  });
  const successMap = new Map(successCounts.map((s) => [s.agentName, s._count._all]));

  const rollups: AgentRollup[] = grouped.map((g) => {
    const runs = g._count._all;
    const ok = successMap.get(g.agentName) ?? 0;
    const sumLatency = g._sum.latencyMs ?? 0;
    return {
      agentName: g.agentName,
      runs,
      successRate: runs > 0 ? ok / runs : 0,
      avgLatencyMs: runs > 0 ? Math.round(sumLatency / runs) : null,
      totalCostUsd: g._sum.costUsd ?? 0,
    };
  });

  return {
    recent: recent.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      agentName: r.agentName,
      model: r.model,
      status: r.status,
      latencyMs: r.latencyMs,
      costUsd: r.costUsd,
      totalTokens:
        r.inputTokens !== null && r.outputTokens !== null
          ? r.inputTokens + r.outputTokens
          : null,
      errorType: r.errorType,
    })),
    rollups,
    totalRuns,
  };
}
