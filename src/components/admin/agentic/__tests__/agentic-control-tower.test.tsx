/**
 * Agentic Control Tower V2 — component render contracts (SSR).
 *
 * Covers the new tower components: command summary, section nav, topology,
 * capabilities board, agents overview, safety boundary. Asserts the information
 * architecture (autonomous / gated / never-autonomous in product language), and
 * that NO execution control exists (no <button>/<form>/<input>, no Run/Execute/
 * Launch/Send/Deploy/Source/Mark-live actionable controls). renderToStaticMarkup
 * (repo convention — vitest env node, no @testing-library).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgenticCommandSummary } from "@/components/admin/agentic/agentic-command-summary";
import { AgenticSectionNav } from "@/components/admin/agentic/agentic-section-nav";
import { AgenticTopologyMap } from "@/components/admin/agentic/agentic-topology-map";
import { AgenticCapabilitiesBoard } from "@/components/admin/agentic/agentic-capabilities-board";
import { AgenticAgentsOverview } from "@/components/admin/agentic/agentic-agents-overview";
import { AgenticSafetyBoundary } from "@/components/admin/agentic/agentic-safety-boundary";
import { buildTowerSummary } from "@/lib/agentic/system-map/tower-summary";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import { buildActionReadinessMatrix } from "@/lib/agentic/action-readiness";
import {
  CREW_SIMULATION_SCENARIOS,
  simulateCrewFlow,
  isCrewSimulationError,
} from "@/lib/agentic/crew-simulation";
import type { CrewSimulationResult } from "@/lib/agentic/crew-simulation/types";

const CC = getAgenticControlCenterData();
const MATRIX = buildActionReadinessMatrix("static");
const SIMS: CrewSimulationResult[] = CREW_SIMULATION_SCENARIOS.map((s) =>
  simulateCrewFlow(s.id),
).filter((r): r is CrewSimulationResult => !isCrewSimulationError(r));
const SUMMARY = buildTowerSummary({
  controlCenter: CC,
  observability: null,
  actionReadiness: MATRIX,
  crewSimulations: SIMS,
});

const NO_WRITE_CONTROLS = (html: string) => {
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<input");
};
const NO_RUN_CONTROLS = (html: string) => {
  NO_WRITE_CONTROLS(html);
  const actionable = /<(button|a)[^>]*>\s*(run|execute|launch|send|deploy|source|mark live)\b/i;
  expect(actionable.test(html)).toBe(false);
};

describe("AgenticCommandSummary", () => {
  const html = renderToStaticMarkup(<AgenticCommandSummary summary={SUMMARY} />);

  it("renders the hero with health + product headline numbers", () => {
    expect(html).toContain("Agentic platform");
    expect(html).toContain("Autonomous, read-only");
    expect(html).toContain("Gated writes");
    expect(html).toContain("Never autonomous");
    expect(html.toLowerCase()).toContain("nothing executes");
    NO_RUN_CONTROLS(html);
  });

  it("renders nothing when summary is null", () => {
    expect(renderToStaticMarkup(<AgenticCommandSummary summary={null} />)).toBe("");
  });
});

describe("AgenticSectionNav", () => {
  const html = renderToStaticMarkup(<AgenticSectionNav />);
  it("renders in-page anchor links for the tower sections", () => {
    expect(html).toContain('href="#overview"');
    expect(html).toContain('href="#topology"');
    expect(html).toContain('href="#capabilities"');
    expect(html).toContain('href="#action-readiness"');
    expect(html).toContain('href="#safety-boundary"');
    NO_RUN_CONTROLS(html);
  });
  it("links are in-page anchors only (no external/exec hrefs)", () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");
    for (const h of hrefs) expect(h.startsWith("#")).toBe(true);
  });
});

describe("AgenticTopologyMap", () => {
  const html = renderToStaticMarkup(
    <AgenticTopologyMap
      controlCenter={CC}
      observability={null}
      actionReadiness={MATRIX}
      crewSimulations={SIMS}
    />,
  );
  it("renders a readable schema with the major blocks (not 32 cards)", () => {
    expect(html).toContain("Intent Router");
    expect(html).toContain("Compliance Guards");
    expect(html).toContain("HITL Gates");
    expect(html).toContain("Tool Boundary");
    expect(html).toContain("Agents & Crews".replace("&", "&amp;"));
    expect(html).toContain("Forbidden Zone");
    expect(html).toContain("Observability");
    // topology node classes for the schema layout
    expect(html).toContain("agentic-topology-node");
    expect(html).toContain('data-tone="control"');
    NO_RUN_CONTROLS(html);
  });
});

describe("AgenticCapabilitiesBoard", () => {
  const html = renderToStaticMarkup(<AgenticCapabilitiesBoard matrix={MATRIX} />);
  it("labels capabilities in product language (autonomous / gated / never)", () => {
    expect(html).toContain("Autonomous today");
    expect(html).toContain("Draft / proposal only");
    expect(html).toContain("Confirmed write, gated");
    expect(html).toContain("Never autonomous");
    expect(html.toLowerCase()).toContain("a human must confirm");
    NO_RUN_CONTROLS(html);
  });
  it("renders nothing when matrix is null", () => {
    expect(renderToStaticMarkup(<AgenticCapabilitiesBoard matrix={null} />)).toBe("");
  });
});

describe("AgenticAgentsOverview", () => {
  const html = renderToStaticMarkup(<AgenticAgentsOverview controlCenter={CC} />);
  it("groups agents by domain (lanes), not 22 equal cards", () => {
    expect(html).toContain("Agents &amp; Crews");
    expect(html).toContain("agentic-agents-lane");
    expect(html).toContain("Compliance");
    expect(html).toContain("Outreach");
    expect(html).toContain("reads only");
    NO_RUN_CONTROLS(html);
  });
  it("renders nothing when controlCenter is null", () => {
    expect(renderToStaticMarkup(<AgenticAgentsOverview controlCenter={null} />)).toBe("");
  });
});

describe("AgenticSafetyBoundary", () => {
  const html = renderToStaticMarkup(
    <AgenticSafetyBoundary controlCenter={CC} matrix={MATRIX} />,
  );
  it("states the hard limits in plain language", () => {
    expect(html).toContain("Safety Boundary");
    expect(html).toContain("Nothing executes here");
    expect(html).toContain("never autonomous");
    expect(html.toLowerCase()).toContain("human");
    NO_RUN_CONTROLS(html);
  });
});
