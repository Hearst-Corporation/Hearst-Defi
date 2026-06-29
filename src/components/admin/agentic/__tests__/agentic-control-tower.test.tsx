/**
 * Agentic Control Tower — component render contracts (SSR).
 *
 * Rewritten 2026-06-26 for the line/table/collapse console: status line,
 * topology table, capabilities table, agents table (domain sub-headers), safety
 * table — all inside collapsible <details> groups. Asserts the information
 * architecture (autonomous / gated / never-autonomous in product language), and
 * that NO execution control exists (no <button>/<form>/<input>, no Run/Execute/
 * Launch/Send/Deploy/Source/Mark-live actionable controls).
 * renderToStaticMarkup (repo convention — vitest env node, no @testing-library).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgenticStatusLine } from "@/components/admin/agentic/agentic-command-summary";
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

describe("AgenticStatusLine", () => {
  const html = renderToStaticMarkup(<AgenticStatusLine summary={SUMMARY} />);

  it("renders the status line with health + product headline numbers", () => {
    expect(html).toContain("agentic-statusline");
    expect(html).toContain("Autonomous, read-only");
    expect(html).toContain("Gated writes");
    expect(html).toContain("Never autonomous");
    NO_RUN_CONTROLS(html);
  });

  it("renders nothing when summary is null", () => {
    expect(renderToStaticMarkup(<AgenticStatusLine summary={null} />)).toBe("");
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
  it("renders a readable facts table with the major blocks (not a card wall)", () => {
    expect(html).toContain("Intent Router");
    expect(html).toContain("Compliance Guards");
    expect(html).toContain("HITL Gates");
    expect(html).toContain("Tool Boundary");
    expect(html).toContain("Agents & Crews".replace("&", "&amp;"));
    expect(html).toContain("Forbidden Zone");
    expect(html).toContain("Observability");
    // line/table console primitives — the topology now renders the canon
    // Catalyst table (Mission #064), wrapped in the agentic-group body.
    expect(html).toContain("agentic-group");
    expect(html).toContain("<table");
    NO_RUN_CONTROLS(html);
  });
});

describe("AgenticCapabilitiesBoard", () => {
  const html = renderToStaticMarkup(<AgenticCapabilitiesBoard matrix={MATRIX} />);
  it("labels capabilities in product language (autonomous / gated / never)", () => {
    expect(html).toContain("Autonomous");
    expect(html).toContain("Draft only");
    expect(html).toContain("Gated write");
    expect(html).toContain("Never autonomous");
    expect(html.toLowerCase()).toContain("human");
    NO_RUN_CONTROLS(html);
  });
  it("renders nothing when matrix is null", () => {
    expect(renderToStaticMarkup(<AgenticCapabilitiesBoard matrix={null} />)).toBe("");
  });
});

describe("AgenticAgentsOverview", () => {
  const html = renderToStaticMarkup(<AgenticAgentsOverview controlCenter={CC} />);
  it("groups agents by domain (sub-header rows), not 22 equal cards", () => {
    // Canonized 2026-06-29: the "Agents & Crews" heading is provided by the
    // parent AdminSectionCard; this frameless body owns the domain groups.
    expect(html).toContain("agentic-table-subhead");
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
    // Canonized 2026-06-29: the "Safety Boundary" heading is provided by the
    // parent AdminSectionCard; the pillars (body) still state the hard limits.
    expect(html).toContain("Nothing executes here");
    expect(html).toContain("never autonomous");
    expect(html.toLowerCase()).toContain("human");
    NO_RUN_CONTROLS(html);
  });
});
