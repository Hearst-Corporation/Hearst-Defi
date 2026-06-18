import "server-only";

import { prisma } from "@/lib/db";

export interface MonitoringStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  /** cockpit-chat turns blocked by output-guard (status success, errorType compliance_blocked). */
  complianceBlockedRuns: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  runsByAgent: Array<{ agentName: string; count: number; costUsd: number }>;
  recentRuns: Array<{
    id: string;
    agentName: string;
    model: string;
    status: string;
    errorType: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number | null;
    costUsd: number | null;
    createdAt: Date;
  }>;
  // OBS-06: navigate decisions of the Master Agent (published | blocked).
  recentNavTraces: Array<{
    id: string;
    profile: string;
    mode: string;
    destinationKey: string | null;
    status: string;
    reason: string | null;
    createdAt: Date;
  }>;
  // OBS-06: admin read/write tool executions (success | blocked | failed).
  recentToolRuns: Array<{
    id: string;
    toolId: string;
    toolKind: string;
    status: string;
    latencyMs: number | null;
    errorMessage: string | null;
    createdAt: Date;
  }>;
}

export async function getMonitoringStats(): Promise<MonitoringStats> {
  const [
    totalRuns,
    successfulRuns,
    failedRuns,
    complianceBlockedRuns,
    totalCost,
    avgLatency,
    runsByAgent,
    recentRuns,
    recentNavTraces,
    recentToolRuns,
  ] = await Promise.all([
    prisma.llmRun.count(),
    prisma.llmRun.count({ where: { status: "success" } }),
    prisma.llmRun.count({ where: { status: { in: ["failed", "timeout"] } } }),
    prisma.llmRun.count({
      where: { agentName: "cockpit-chat", errorType: "compliance_blocked" },
    }),
    prisma.llmRun.aggregate({ _sum: { costUsd: true } }),
    prisma.llmRun.aggregate({ _avg: { latencyMs: true } }),
    prisma.llmRun.groupBy({
      by: ["agentName"],
      _count: { agentName: true },
      _sum: { costUsd: true },
    }),
    prisma.llmRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        agentName: true,
        model: true,
        status: true,
        errorType: true,
        inputTokens: true,
        outputTokens: true,
        latencyMs: true,
        costUsd: true,
        createdAt: true,
      },
    }),
    prisma.navTrace.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        profile: true,
        mode: true,
        destinationKey: true,
        status: true,
        reason: true,
        createdAt: true,
      },
    }),
    prisma.adminToolRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        toolId: true,
        toolKind: true,
        status: true,
        latencyMs: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    totalRuns,
    successfulRuns,
    failedRuns,
    complianceBlockedRuns,
    totalCostUsd: totalCost._sum.costUsd ?? 0,
    avgLatencyMs: Math.round(avgLatency._avg.latencyMs ?? 0),
    runsByAgent: runsByAgent.map((r) => ({
      agentName: r.agentName,
      count: r._count.agentName,
      costUsd: r._sum.costUsd ?? 0,
    })),
    recentRuns,
    recentNavTraces,
    recentToolRuns,
  };
}
