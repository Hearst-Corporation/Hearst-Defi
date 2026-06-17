import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/db", () => ({
  prisma: { llmRun: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { loadAgentGraph } from "@/lib/data/agent-graph";

const mockFindMany = vi.mocked(prisma.llmRun.findMany);
const NOW = new Date("2026-06-18T12:00:00.000Z").getTime();

describe("loadAgentGraph", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the static topology with all nodes idle when there are no runs", async () => {
    mockFindMany.mockResolvedValue([] as never);
    const g = await loadAgentGraph(NOW);
    expect(g.nodes.length).toBeGreaterThanOrEqual(10);
    expect(g.nodes.every((n) => n.state === "idle")).toBe(true);
    // Edges reference only known node ids.
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(g.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
    // No hot edge when nothing is active.
    expect(g.edges.some((e) => e.hot)).toBe(false);
  });

  it("marks an agent active on a recent success and makes its incoming edges hot", async () => {
    mockFindMany.mockResolvedValue([
      {
        agentName: "investor-memo",
        status: "success",
        createdAt: new Date(NOW - 60_000),
        latencyMs: 1234,
        costUsd: 0.0042,
      },
    ] as never);
    const g = await loadAgentGraph(NOW);
    const memo = g.nodes.find((n) => n.id === "investor-memo");
    expect(memo?.state).toBe("active");
    expect(memo?.samples[0]?.latencyMs).toBe(1234);
    // Edges pointing INTO investor-memo are hot.
    expect(g.edges.some((e) => e.to === "investor-memo" && e.hot)).toBe(true);
  });

  it("marks a failed latest run as failed", async () => {
    mockFindMany.mockResolvedValue([
      {
        agentName: "mining-health",
        status: "failed",
        createdAt: new Date(NOW - 30_000),
        latencyMs: null,
        costUsd: null,
      },
    ] as never);
    const g = await loadAgentGraph(NOW);
    expect(g.nodes.find((n) => n.id === "mining-health")?.state).toBe("failed");
  });

  it("degrades to an all-idle graph on a DB error (page still renders)", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"));
    const g = await loadAgentGraph(NOW);
    expect(g.nodes.every((n) => n.state === "idle")).toBe(true);
    expect(g.edges.length).toBeGreaterThan(0);
  });
});
