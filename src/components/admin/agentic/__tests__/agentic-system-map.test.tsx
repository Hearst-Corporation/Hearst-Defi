/**
 * AgenticSystemMap (Layer 1) — read-only render contract.
 *
 * Verifies the first-layer visual map: heading, live badge, edge legend, group
 * clusters, required nodes, status data-attributes, wire chips, and the safety
 * notes — with NO write/action controls (no <button>, <form>, <input>). SSR
 * render (repo convention — no @testing-library; vitest env is node). Note:
 * renderToStaticMarkup HTML-escapes "&", so labels are matched on safe substrings.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgenticSystemMap } from "@/components/admin/agentic/agentic-system-map";
import { buildAgenticSystemMap } from "@/lib/agentic/system-map/build-system-map";
import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { AgenticSystemMap as AgenticSystemMapType } from "@/lib/agentic/system-map/types";

function controlCenter(): AgenticControlCenterData {
  return {
    generatedAt: "static",
    version: "v0.1",
    router: {
      deterministicRouterExists: true,
      status: "active",
      mode: "non-shadow",
      version: "router v2",
      shadowFlag: { name: "AGENTIC_ROUTER_SHADOW", alive: false, notes: "dead" },
      routerPaths: [],
      activePaths: [],
      shadowOnlyPaths: [],
      educationalSteering: "",
      dangerousIntentPolicy: "",
      guardPolicy: "",
      guardAssertions: [],
      statusBlock: [],
      release: {
        lotStatus: "closed",
        mergeCommit: "x",
        mergePr: "x",
        lockReleaseCommit: "x",
        lockReleasePr: "x",
        vercel: "ready",
        validations: [],
      },
      paths: [],
      legacyFallback: { status: "legacy", notes: "" },
    },
    inventory: [],
    gates: [],
    tools: [],
    toolBoundaryV1: {
      generatedAt: "static",
      source: "code_reflection",
      counts: { read_only: 11, draft_or_proposal: 6, confirmed_write: 1, forbidden_autonomous: 8, unknown: 0 },
      tools: [],
      consistencyIssues: [],
      safetyNotes: ["x"],
    },
    prompts: [],
    safetySummary: [{ id: "s1", claim: "x", holds: true, evidence: "x" }],
    nextSteps: [],
  };
}

const MAP: AgenticSystemMapType = buildAgenticSystemMap({
  controlCenter: controlCenter(),
  observability: null,
  reporting: null,
});

function render(map: AgenticSystemMapType | null | undefined): string {
  return renderToStaticMarkup(<AgenticSystemMap map={map} />);
}

const NO_WRITE_CONTROLS = (html: string) => {
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<input");
};

describe("AgenticSystemMap v0", () => {
  it("renders the first-layer heading + live read-only badge", () => {
    const html = render(MAP);
    expect(html).toContain("System Map");
    expect(html).toContain("live");
    expect(html).toContain("read-only");
    NO_WRITE_CONTROLS(html);
  });

  it("renders the four layer clusters", () => {
    const html = render(MAP);
    expect(html).toContain("Control Layer");
    expect(html).toContain("Observability Layer");
    expect(html).toContain("Tool Layer");
    // "Crews & Agents" — "&" is HTML-escaped; match a safe substring.
    expect(html).toContain("Crews");
  });

  it("renders the required control + tool nodes", () => {
    const html = render(MAP);
    expect(html).toContain("Intent Router");
    expect(html).toContain("Compliance Guards");
    expect(html).toContain("HITL Gates");
    expect(html).toContain("Tool Boundary");
    expect(html).toContain("Forbidden-Autonomous");
    expect(html).toContain("Reporting Crew");
    NO_WRITE_CONTROLS(html);
  });

  it("renders the edge legend with connection kinds", () => {
    const html = render(MAP);
    expect(html).toContain("Connections");
    expect(html).toContain("routes");
    expect(html).toContain("guards");
    expect(html).toContain("observes");
    expect(html).toContain("forbids");
  });

  it("renders node status data-attributes for CSS theming", () => {
    const html = render(MAP);
    expect(html).toContain('data-status="healthy"');
    expect(html).toContain("agentic-map-node");
    expect(html).toContain("agentic-map-status-dot");
  });

  it("renders wire chips describing how nodes connect", () => {
    const html = render(MAP);
    expect(html).toContain("agentic-map-wire");
    expect(html).toMatch(/routes/);
  });

  it("renders the verbatim read-only safety note", () => {
    const html = render(MAP);
    expect(html).toContain("No tool is executed, no write is performed");
    NO_WRITE_CONTROLS(html);
  });

  it("renders nothing when map is null/undefined", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });
});
