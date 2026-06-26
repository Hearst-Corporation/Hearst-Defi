import { describe, expect, it } from "vitest";

import {
  buildAgenticSystemMap,
  getActionReadinessMatrix,
  getCrewSimulations,
  getAgenticSystemMap,
} from "@/lib/agentic/system-map";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import { buildActionReadinessMatrix } from "@/lib/agentic/action-readiness";

// Visual Integration V1: the system map wires the action-readiness matrix and
// the crew-simulation scenarios. Pure — no I/O, no tool execution.

const MATRIX = buildActionReadinessMatrix("static");
const SIMS = getCrewSimulations();

function build() {
  return buildAgenticSystemMap({
    controlCenter: getAgenticControlCenterData(),
    observability: null,
    reporting: null,
    actionReadiness: MATRIX,
    crewSimulations: SIMS,
  });
}

const REQUIRED_ACTION_NODES = [
  "action-readiness",
  "read-only-actions",
  "draft-actions",
  "confirmed-write-actions",
  "forbidden-actions",
];

const REQUIRED_FLOW_NODES = [
  "crew-simulation",
  "reporting-crew-flow",
  "outreach-draft-flow",
  "product-review-flow",
  "risk-explanation-flow",
  "vault-readiness-flow",
  "memory-distill-flow",
];

describe("system map integration — action readiness", () => {
  it("includes the action-readiness node + the four tier nodes", () => {
    const ids = new Set(build().nodes.map((n) => n.id));
    for (const id of REQUIRED_ACTION_NODES) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
  });

  it("action node metrics reflect the matrix counts (11/5/1/8)", () => {
    const nodes = build().nodes;
    const m = (id: string) =>
      nodes.find((n) => n.id === id)!.metrics?.find((x) => x.label === "count")?.value;
    expect(m("read-only-actions")).toBe(String(MATRIX.counts.read_only));
    expect(m("draft-actions")).toBe(String(MATRIX.counts.draft_or_proposal));
    expect(m("confirmed-write-actions")).toBe(String(MATRIX.counts.confirmed_write));
    expect(m("forbidden-actions")).toBe(String(MATRIX.counts.forbidden_autonomous));
    // The real matrix is 10 read / 5 draft / 1 confirmed-write / 8 forbidden
    // (3 read-only utility actions added: explain_risk/explain_provenance/read_session_context).
    expect(MATRIX.counts.read_only).toBe(11);
    expect(MATRIX.counts.draft_or_proposal).toBe(5);
    expect(MATRIX.counts.confirmed_write).toBe(1);
    expect(MATRIX.counts.forbidden_autonomous).toBe(8);
  });

  it("forbidden-actions node is mode forbidden + risk critical", () => {
    const node = build().nodes.find((n) => n.id === "forbidden-actions")!;
    expect(node.mode).toBe("forbidden");
    expect(node.risk).toBe("critical");
  });

  it("wires action readiness edges (tool-boundary→readiness→tiers, hitl/guard)", () => {
    const edges = build().edges;
    const has = (from: string, to: string) =>
      edges.some((e) => e.from === from && e.to === to);
    expect(has("tool-boundary", "action-readiness")).toBe(true);
    expect(has("action-readiness", "read-only-actions")).toBe(true);
    expect(has("action-readiness", "draft-actions")).toBe(true);
    expect(has("action-readiness", "confirmed-write-actions")).toBe(true);
    expect(has("action-readiness", "forbidden-actions")).toBe(true);
    expect(has("hitl-gates", "draft-actions")).toBe(true);
    expect(has("hitl-gates", "confirmed-write-actions")).toBe(true);
    expect(has("guard", "forbidden-actions")).toBe(true);
    // forbidden edge kind is "forbids"
    expect(
      edges.find((e) => e.from === "action-readiness" && e.to === "forbidden-actions")!.kind,
    ).toBe("forbids");
  });
});

describe("system map integration — crew simulation", () => {
  it("includes the crew-simulation node + six flow nodes", () => {
    const ids = new Set(build().nodes.map((n) => n.id));
    for (const id of REQUIRED_FLOW_NODES) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
  });

  it("crew-simulation node reports 7 scenarios + 0 executable", () => {
    const node = build().nodes.find((n) => n.id === "crew-simulation")!;
    const scenarios = node.metrics?.find((m) => m.label === "scenarios")?.value;
    const exec = node.metrics?.find((m) => m.label === "executable")?.value;
    expect(scenarios).toBe("7");
    expect(exec).toBe("0");
    expect(SIMS).toHaveLength(7);
  });

  it("every flow node carries executable: false in its metrics", () => {
    const flows = build().nodes.filter((n) => REQUIRED_FLOW_NODES.includes(n.id) && n.id !== "crew-simulation");
    for (const f of flows) {
      const exec = f.metrics?.find((m) => m.label === "executable")?.value;
      expect(exec, `${f.id} executable`).toBe("false");
    }
  });

  it("wires crew simulation edges (sim→flows, flow→reads/gates/forbids)", () => {
    const edges = build().edges;
    const has = (from: string, to: string) =>
      edges.some((e) => e.from === from && e.to === to);
    expect(has("crew-simulation", "reporting-crew-flow")).toBe(true);
    expect(has("crew-simulation", "memory-distill-flow")).toBe(true);
    expect(has("reporting-crew-flow", "router-observability")).toBe(true);
    expect(has("outreach-draft-flow", "hitl-gates")).toBe(true);
    expect(has("vault-readiness-flow", "forbidden-actions")).toBe(true);
    expect(
      edges.find((e) => e.from === "vault-readiness-flow" && e.to === "forbidden-actions")!.kind,
    ).toBe("forbids");
  });
});

describe("system map integration — invariants preserved", () => {
  it("no duplicate node ids with the new nodes", () => {
    const ids = build().nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no dangling edges with the new edges", () => {
    const map = build();
    const ids = new Set(map.nodes.map((n) => n.id));
    for (const e of map.edges) {
      expect(ids.has(e.from), `dangling from ${e.from}`).toBe(true);
      expect(ids.has(e.to), `dangling to ${e.to}`).toBe(true);
    }
  });

  it("still includes the original required nodes (router/guard/tool-boundary/...)", () => {
    const ids = new Set(build().nodes.map((n) => n.id));
    for (const id of ["router", "guard", "hitl-gates", "tool-boundary", "reporting-crew", "router-observability"]) {
      expect(ids.has(id), `lost ${id}`).toBe(true);
    }
  });

  it("the new action + simulation groups exist", () => {
    const groupIds = new Set(build().groups.map((g) => g.id));
    expect(groupIds.has("actions")).toBe(true);
    expect(groupIds.has("simulation")).toBe(true);
  });

  it("degrades to no_data nodes when readiness/simulations are absent", () => {
    const map = buildAgenticSystemMap({
      controlCenter: getAgenticControlCenterData(),
      observability: null,
      reporting: null,
      actionReadiness: null,
      crewSimulations: null,
    });
    expect(map.nodes.find((n) => n.id === "action-readiness")!.status).toBe("no_data");
    expect(map.nodes.find((n) => n.id === "crew-simulation")!.status).toBe("no_data");
    // Still no dangling edges / duplicates.
    const ids = new Set(map.nodes.map((n) => n.id));
    for (const e of map.edges) {
      expect(ids.has(e.from) && ids.has(e.to)).toBe(true);
    }
  });
});

describe("system map integration — entry point helpers", () => {
  it("getActionReadinessMatrix returns the 25-action matrix", () => {
    const m = getActionReadinessMatrix();
    expect(m).not.toBeNull();
    expect(m!.items.length).toBe(25);
  });

  it("getCrewSimulations returns 7 non-error results, all executable false", () => {
    const sims = getCrewSimulations();
    expect(sims).toHaveLength(7);
    for (const s of sims) {
      expect(s.scenario.executable).toBe(false);
    }
  });

  it("getAgenticSystemMap wires readiness + simulations end-to-end", () => {
    const map = getAgenticSystemMap({
      controlCenter: getAgenticControlCenterData(),
      observability: null,
      reporting: null,
    });
    const ids = new Set(map.nodes.map((n) => n.id));
    expect(ids.has("action-readiness")).toBe(true);
    expect(ids.has("crew-simulation")).toBe(true);
    expect(ids.has("reporting-crew-flow")).toBe(true);
  });
});
