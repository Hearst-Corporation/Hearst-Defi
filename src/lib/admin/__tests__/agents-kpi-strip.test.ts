import { describe, expect, it } from "vitest";

import { buildAgentsKpiStrip } from "@/lib/admin/agents-kpi-strip";
import type { AgentGraphNode } from "@/lib/data/agent-graph";
import type { AgentTemplateRow } from "@/lib/data/agent-templates";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNode(
  agentName: string | null,
  state: "active" | "idle" | "failed",
  recentRuns: number,
): AgentGraphNode {
  return {
    id: agentName ?? "source",
    label: agentName ?? "Source",
    kind: agentName !== null ? "agent" : "source",
    agentName,
    state,
    lastRunIso: null,
    recentRuns,
    samples: [],
    column: 1,
  };
}

function makeTemplate(
  id: string,
  archived: boolean,
  usageCount = 0,
): AgentTemplateRow {
  return {
    id,
    slug: id,
    label: id,
    description: null,
    baseAgent: "cockpit-chat",
    tone: null,
    language: null,
    verbosity: null,
    systemAdditions: null,
    archived,
    usageCount,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const BASE_AGENT_COUNT = 8;

// ---------------------------------------------------------------------------
// Empty / suppressed
// ---------------------------------------------------------------------------

describe("buildAgentsKpiStrip — suppression", () => {
  it("returns [] when no templates and no runs", () => {
    const result = buildAgentsKpiStrip({
      templates: [],
      nodes: [makeNode("mining-health", "idle", 0)],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("buildAgentsKpiStrip — structure", () => {
  it("includes Base agents and Persona templates when templates exist", () => {
    const result = buildAgentsKpiStrip({
      templates: [makeTemplate("t1", false)],
      nodes: [],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    const labels = result.map((k) => k.label);
    expect(labels).toContain("Base agents");
    expect(labels).toContain("Persona templates");
  });

  it("includes Runs (24 h) when there are runs", () => {
    const result = buildAgentsKpiStrip({
      templates: [makeTemplate("t1", false)],
      nodes: [makeNode("mining-health", "active", 12)],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    const runs = result.find((k) => k.label === "Runs (24 h)");
    expect(runs).toBeDefined();
    expect(runs!.value).toBe("12");
    expect(runs!.provenance).toBe("live");
  });

  it("omits Runs (24 h) when total is 0", () => {
    const result = buildAgentsKpiStrip({
      templates: [makeTemplate("t1", false)],
      nodes: [makeNode("mining-health", "idle", 0)],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    expect(result.find((k) => k.label === "Runs (24 h)")).toBeUndefined();
  });

  it("Active surfaces shows 'None' when all idle but some runs exist", () => {
    const result = buildAgentsKpiStrip({
      templates: [makeTemplate("t1", false)],
      nodes: [makeNode("mining-health", "idle", 5)],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    const active = result.find((k) => k.label === "Active surfaces");
    expect(active).toBeDefined();
    expect(active!.value).toBe("None");
    expect(active!.alert).toBe(true);
  });

  it("Active surfaces counts only active-state nodes", () => {
    const result = buildAgentsKpiStrip({
      templates: [makeTemplate("t1", false)],
      nodes: [
        makeNode("mining-health", "active", 10),
        makeNode("risk-explanation", "idle", 2),
        makeNode("cockpit-chat", "active", 8),
      ],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    const active = result.find((k) => k.label === "Active surfaces");
    expect(active?.value).toBe("2");
  });

  it("non-agent nodes (source/output, agentName null) do not count toward runs or active", () => {
    const result = buildAgentsKpiStrip({
      templates: [makeTemplate("t1", false)],
      nodes: [
        makeNode(null, "active", 99), // source — should not count
        makeNode("mining-health", "active", 3),
      ],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    const runs = result.find((k) => k.label === "Runs (24 h)");
    expect(runs?.value).toBe("3"); // only the LLM node's 3 runs
    const active = result.find((k) => k.label === "Active surfaces");
    expect(active?.value).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Provenance honesty
// ---------------------------------------------------------------------------

describe("buildAgentsKpiStrip — provenance honesty", () => {
  it("Base agents and Persona templates are always 'manual'", () => {
    const result = buildAgentsKpiStrip({
      templates: [makeTemplate("t1", false)],
      nodes: [makeNode("mining-health", "active", 5)],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    expect(result.find((k) => k.label === "Base agents")?.provenance).toBe("manual");
    expect(result.find((k) => k.label === "Persona templates")?.provenance).toBe("manual");
  });

  it("Runs (24 h) and Active surfaces are always 'live'", () => {
    const result = buildAgentsKpiStrip({
      templates: [makeTemplate("t1", false)],
      nodes: [makeNode("mining-health", "active", 5)],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    expect(result.find((k) => k.label === "Runs (24 h)")?.provenance).toBe("live");
    expect(result.find((k) => k.label === "Active surfaces")?.provenance).toBe("live");
  });
});

// ---------------------------------------------------------------------------
// Archived sublabel
// ---------------------------------------------------------------------------

describe("buildAgentsKpiStrip — archived sublabel", () => {
  it("shows archived count in sublabel when archived templates exist", () => {
    const result = buildAgentsKpiStrip({
      templates: [makeTemplate("t1", false), makeTemplate("t2", true)],
      nodes: [],
      baseAgentCount: BASE_AGENT_COUNT,
    });
    const tpl = result.find((k) => k.label === "Persona templates");
    expect(tpl?.sublabel).toContain("1 archived");
    expect(tpl?.value).toBe("1"); // only active counted
  });
});
