import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/db", () => ({
  prisma: {
    llmRun: { findMany: vi.fn() },
    adminToolRun: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { loadAgentGraph, loadAgentGraphViews } from "@/lib/data/agent-graph";

const mockLlmFindMany = vi.mocked(prisma.llmRun.findMany);
const mockToolFindMany = vi.mocked(prisma.adminToolRun.findMany);
const NOW = new Date("2026-06-18T12:00:00.000Z").getTime();

describe("loadAgentGraph (orchestration, back-compat)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the static topology; bound nodes idle, structural nodes static when there are no runs", async () => {
    mockLlmFindMany.mockResolvedValue([] as never);
    const g = await loadAgentGraph(NOW);
    expect(g.nodes.length).toBeGreaterThanOrEqual(10);
    // Every node is either idle (bound, no recent run) or static (no binding).
    expect(g.nodes.every((n) => n.state === "idle" || n.state === "static")).toBe(true);
    // LLM-bound nodes (agentName set) are idle, never static.
    expect(
      g.nodes.filter((n) => n.agentName !== null).every((n) => n.state === "idle"),
    ).toBe(true);
    // Edges reference only known node ids.
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(g.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
    // No hot edge when nothing is active.
    expect(g.edges.some((e) => e.hot)).toBe(false);
  });

  it("marks an agent active on a recent success and makes its incoming edges hot", async () => {
    mockLlmFindMany.mockResolvedValue([
      {
        id: "llm:turn_graph-1",
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
    expect(memo?.samples[0]?.turnId).toBe("turn_graph-1");
    expect(g.edges.some((e) => e.to === "investor-memo" && e.hot)).toBe(true);
  });

  it("marks a failed latest run as failed", async () => {
    mockLlmFindMany.mockResolvedValue([
      {
        id: "llm:turn_graph-2",
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

  it("degrades to a bound-idle / structural-static graph on a DB error (page still renders)", async () => {
    mockLlmFindMany.mockRejectedValue(new Error("db down"));
    const g = await loadAgentGraph(NOW);
    expect(g.nodes.every((n) => n.state === "idle" || n.state === "static")).toBe(true);
    expect(g.edges.length).toBeGreaterThan(0);
  });
});

describe("loadAgentGraphViews (multi-view, LlmRun + AdminToolRun)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the three views with valid edges and live bindings", async () => {
    mockLlmFindMany.mockResolvedValue([] as never);
    mockToolFindMany.mockResolvedValue([] as never);
    const { views } = await loadAgentGraphViews(NOW);
    expect(views.map((v) => v.id)).toEqual([
      "orchestration",
      "master-agent",
      "instruments",
    ]);
    for (const v of views) {
      const ids = new Set(v.nodes.map((n) => n.id));
      expect(v.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
    }
    // The instruments view exposes all 19 tools + the caller (10 base read
    // [incl. run_product_construction] + 2 outreach read + 2 base write + 3
    // outreach write + 2 canvas write [create_vault_draft, create_campaign_draft]).
    const instruments = views.find((v) => v.id === "instruments")!;
    const toolNodes = instruments.nodes.filter((n) => n.kind === "tool");
    expect(toolNodes).toHaveLength(19);
    expect(toolNodes.every((n) => n.bindingKind === "tool")).toBe(true);
  });

  it("lights up a tool node + its tool-group aggregate from AdminToolRun", async () => {
    mockLlmFindMany.mockResolvedValue([] as never);
    mockToolFindMany.mockResolvedValue([
      {
        id: "tool:turn_tool-1:read_market_snapshot:sample",
        toolId: "read_market_snapshot",
        toolKind: "read",
        status: "success",
        createdAt: new Date(NOW - 60_000),
        latencyMs: 88,
      },
    ] as never);
    const { views } = await loadAgentGraphViews(NOW);

    // Instruments view: the specific tool node is active.
    const instruments = views.find((v) => v.id === "instruments")!;
    const snap = instruments.nodes.find((n) => n.id === "inst-read_market_snapshot");
    expect(snap?.state).toBe("active");
    expect(snap?.samples[0]?.latencyMs).toBe(88);
    expect(snap?.samples[0]?.turnId).toBe("turn_tool-1");

    // Master-agent view: the read-tools aggregate node is active + its edge hot.
    const master = views.find((v) => v.id === "master-agent")!;
    const readGroup = master.nodes.find((n) => n.id === "ma-readtools");
    expect(readGroup?.bindingKind).toBe("tool-group");
    expect(readGroup?.state).toBe("active");
    expect(master.edges.some((e) => e.to === "ma-readtools" && e.hot)).toBe(true);
  });

  it("marks a blocked write tool without crashing and keeps it non-failed", async () => {
    mockLlmFindMany.mockResolvedValue([] as never);
    mockToolFindMany.mockResolvedValue([
      {
        id: "tool:turn_tool-2:create_governance_proposal_draft:sample",
        toolId: "create_governance_proposal_draft",
        toolKind: "write",
        status: "blocked",
        createdAt: new Date(NOW - 120_000),
        latencyMs: 12,
      },
    ] as never);
    const { views } = await loadAgentGraphViews(NOW);
    const instruments = views.find((v) => v.id === "instruments")!;
    const gov = instruments.nodes.find(
      (n) => n.id === "inst-create_governance_proposal_draft",
    );
    // "blocked" is a guardrail success, not a surface failure → active (recent).
    expect(gov?.state).toBe("active");
    expect(gov?.confirmationRequired).toBe(true);
    expect(gov?.riskLevel).toBe("high");
  });

  it("degrades tool nodes to static-or-idle when AdminToolRun query fails", async () => {
    mockLlmFindMany.mockResolvedValue([] as never);
    mockToolFindMany.mockRejectedValue(new Error("tool table down"));
    const { views } = await loadAgentGraphViews(NOW);
    const instruments = views.find((v) => v.id === "instruments")!;
    // Tool nodes have a binding → idle (not static) even on query failure.
    expect(
      instruments.nodes
        .filter((n) => n.kind === "tool")
        .every((n) => n.state === "idle"),
    ).toBe(true);
  });
});
