import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/db", () => ({
  prisma: { llmRun: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { loadAgentPulses } from "@/lib/data/agent-pulse";
import { BASE_AGENTS } from "@/lib/agents/agent-template-constants";

const mockFindMany = vi.mocked(prisma.llmRun.findMany);
const NOW = new Date("2026-06-18T12:00:00.000Z").getTime();

describe("loadAgentPulses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns one pulse per base agent, defaulting unseen agents to idle", async () => {
    mockFindMany.mockResolvedValue([] as never);
    const pulses = await loadAgentPulses(NOW);
    expect(pulses).toHaveLength(BASE_AGENTS.length);
    expect(pulses.every((p) => p.state === "idle")).toBe(true);
    expect(pulses.every((p) => p.lastRunIso === null)).toBe(true);
  });

  it("marks a recent successful run as active", async () => {
    mockFindMany.mockResolvedValue([
      {
        agentName: "cockpit-chat",
        status: "success",
        createdAt: new Date(NOW - 60_000), // 1 min ago
      },
    ] as never);
    const pulses = await loadAgentPulses(NOW);
    const chat = pulses.find((p) => p.agent === "cockpit-chat");
    expect(chat?.state).toBe("active");
    expect(chat?.recentRuns).toBe(1);
  });

  it("marks a failed latest run as failed regardless of recency", async () => {
    mockFindMany.mockResolvedValue([
      {
        agentName: "mining-health",
        status: "failed",
        createdAt: new Date(NOW - 30_000),
      },
    ] as never);
    const pulses = await loadAgentPulses(NOW);
    expect(pulses.find((p) => p.agent === "mining-health")?.state).toBe("failed");
  });

  it("marks an old successful run as idle (not active)", async () => {
    mockFindMany.mockResolvedValue([
      {
        agentName: "investor-memo",
        status: "success",
        createdAt: new Date(NOW - 60 * 60 * 1000), // 1 h ago
      },
    ] as never);
    const pulses = await loadAgentPulses(NOW);
    expect(pulses.find((p) => p.agent === "investor-memo")?.state).toBe("idle");
  });

  it("degrades all agents to idle on a DB error", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"));
    const pulses = await loadAgentPulses(NOW);
    expect(pulses).toHaveLength(BASE_AGENTS.length);
    expect(pulses.every((p) => p.state === "idle")).toBe(true);
  });
});
