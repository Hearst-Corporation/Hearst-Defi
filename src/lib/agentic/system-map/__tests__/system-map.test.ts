// Agentic System Map v0 — pure unit tests.
//
// Tests the static graph builder using real control-center data (zero-arg pure
// function) and null observability/reporting (best-effort). No DB, no LLM, no
// tool execution, no network.

import { describe, test, expect, beforeAll } from "vitest";
import { buildAgenticSystemMap } from "../build-system-map";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import type { AgenticSystemMap } from "../types";

describe("buildAgenticSystemMap", () => {
  let map: AgenticSystemMap;

  beforeAll(() => {
    const controlCenter = getAgenticControlCenterData();
    map = buildAgenticSystemMap({
      controlCenter,
      observability: null,
      reporting: null,
    });
  });

  // ---- Required nodes ---------------------------------------------------------

  test("has required nodes", () => {
    const ids = map.nodes.map((n) => n.id);
    expect(ids).toContain("router");
    expect(ids).toContain("guard");
    expect(ids).toContain("hitl-gates");
    expect(ids).toContain("reporting-crew");
    expect(ids).toContain("tool-boundary");
    expect(ids).toContain("forbidden-autonomous");
    expect(ids).toContain("read-tools");
    expect(ids).toContain("draft-tools");
    expect(ids).toContain("confirmed-write-tools");
  });

  test("has at minimum 10 nodes", () => {
    expect(map.nodes.length).toBeGreaterThanOrEqual(10);
  });

  // ---- No duplicates ----------------------------------------------------------

  test("no duplicate node ids", () => {
    const ids = map.nodes.map((n) => n.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test("no duplicate edge ids", () => {
    const ids = map.edges.map((e) => e.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  // ---- Edge integrity ---------------------------------------------------------

  test("no dangling edges — every from/to references an existing node", () => {
    const nodeIds = new Set(map.nodes.map((n) => n.id));
    map.edges.forEach((e) => {
      expect(nodeIds.has(e.from), `edge ${e.id}: from "${e.from}" not in nodes`).toBe(true);
      expect(nodeIds.has(e.to), `edge ${e.id}: to "${e.to}" not in nodes`).toBe(true);
    });
  });

  test("has at minimum 10 edges", () => {
    expect(map.edges.length).toBeGreaterThanOrEqual(10);
  });

  // ---- Safety-critical nodes --------------------------------------------------

  test("forbidden-autonomous has critical risk and forbidden mode", () => {
    const node = map.nodes.find((n) => n.id === "forbidden-autonomous");
    expect(node?.risk).toBe("critical");
    expect(node?.mode).toBe("forbidden");
  });

  test("reporting-crew is read_only", () => {
    const node = map.nodes.find((n) => n.id === "reporting-crew");
    expect(node?.mode).toBe("read_only");
  });

  test("hitl-gates has high or critical risk", () => {
    const node = map.nodes.find((n) => n.id === "hitl-gates");
    expect(["high", "critical"]).toContain(node?.risk);
  });

  test("guard node exists and is control mode", () => {
    const node = map.nodes.find((n) => n.id === "guard");
    expect(node?.mode).toBe("control");
  });

  test("read-tools are not critical risk", () => {
    const readTools = map.nodes.filter((n) => n.mode === "read_only" && n.type === "tool");
    readTools.forEach((tool) => {
      expect(tool.risk, `${tool.id} should not be critical risk`).not.toBe("critical");
    });
  });

  // ---- Safety notes -----------------------------------------------------------

  test("has safety notes (non-empty array)", () => {
    expect(Array.isArray(map.safetyNotes)).toBe(true);
    expect(map.safetyNotes.length).toBeGreaterThan(0);
  });

  test("safety notes mention read-only", () => {
    const allNotes = map.safetyNotes.join(" ").toLowerCase();
    expect(allNotes).toMatch(/read.?only|no.?write|no.?tool.*execut/);
  });

  // ---- Groups -----------------------------------------------------------------

  test("has groups covering major layers", () => {
    const groupIds = map.groups.map((g) => g.id);
    expect(groupIds).toContain("control");
    expect(groupIds).toContain("crews");
    expect(groupIds).toContain("observability");
    expect(groupIds).toContain("tools");
  });

  test("every node belongs to a known group", () => {
    const groupIds = new Set(map.groups.map((g) => g.id));
    map.nodes.forEach((node) => {
      expect(groupIds.has(node.group), `node "${node.id}" group "${node.group}" not in groups`).toBe(true);
    });
  });

  // ---- Key edge semantics -----------------------------------------------------

  test("reporting-crew reads observability or quality-review", () => {
    const edges = map.edges.filter(
      (e) =>
        e.from === "reporting-crew" &&
        (e.to === "router-observability" || e.to === "quality-review" || e.to === "tool-boundary"),
    );
    expect(edges.length).toBeGreaterThan(0);
  });

  test("router routes to at least one crew or surface", () => {
    const routerEdges = map.edges.filter((e) => e.from === "router" && e.kind === "routes");
    expect(routerEdges.length).toBeGreaterThan(0);
  });

  test("tool-boundary forbids forbidden-autonomous", () => {
    const edge = map.edges.find(
      (e) => e.from === "tool-boundary" && e.to === "forbidden-autonomous" && e.kind === "forbids",
    );
    expect(edge).toBeDefined();
  });

  test("hitl-gates gates at least one write-tier node", () => {
    const gatedEdges = map.edges.filter(
      (e) => e.from === "hitl-gates" && e.kind === "gates",
    );
    expect(gatedEdges.length).toBeGreaterThan(0);
  });

  // ---- Static map marker (no live timestamp) ----------------------------------

  test("generatedAt is a static string, not a real ISO timestamp", () => {
    // Pure code has no Date.now — the marker must not look like a fresh timestamp.
    expect(typeof map.generatedAt).toBe("string");
    expect(map.generatedAt.length).toBeGreaterThan(5);
    // Should NOT be a date like "2026-06-25T…" (that would mean impure Date.now).
    expect(map.generatedAt).not.toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:/);
  });

  // ---- selectedDefaultNodeId --------------------------------------------------

  test("selectedDefaultNodeId references an existing node", () => {
    const ids = new Set(map.nodes.map((n) => n.id));
    expect(ids.has(map.selectedDefaultNodeId)).toBe(true);
  });

  // ---- Best-effort with live observability inputs ----------------------------

  test("degrades gracefully with null observability and null reporting", () => {
    const controlCenter = getAgenticControlCenterData();
    expect(() =>
      buildAgenticSystemMap({ controlCenter, observability: null, reporting: null }),
    ).not.toThrow();
  });

  test("router node gets no_data or healthy status with null observability", () => {
    // Router status is derived from the control-center data (not observability).
    const node = map.nodes.find((n) => n.id === "router");
    expect(["healthy", "watch", "alert", "no_data"]).toContain(node?.status);
  });

  test("observability nodes degrade to no_data when observability is null", () => {
    const obsNode = map.nodes.find((n) => n.id === "router-observability");
    // With null observability, it should be no_data.
    expect(obsNode?.status).toBe("no_data");
  });
});
