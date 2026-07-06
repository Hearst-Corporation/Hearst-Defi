import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Agentic console — page + composition contract. The root /admin/agentic page
// renders the simplified <AgenticConsoleSimple> (3 sections: Agents, Tool
// boundary, Observability). The full <AgenticControlTower> orchestrator moved
// to the /admin/agentic/detailed archive route. The tower still composes its
// sections in the map-first / details-progressive order. These string-level
// checks guard the information architecture without rendering the async server
// component.

const PAGE = readFileSync(
  join(process.cwd(), "src/app/admin/agentic/page.tsx"),
  "utf8",
);
const DETAILED_PAGE = readFileSync(
  join(process.cwd(), "src/app/admin/agentic/detailed/page.tsx"),
  "utf8",
);
const TOWER = readFileSync(
  join(
    process.cwd(),
    "src/components/admin/agentic/agentic-control-tower.tsx",
  ),
  "utf8",
);

describe("agentic root page — simplified console", () => {
  it("the root page renders the simplified AgenticConsoleSimple orchestrator", () => {
    expect(PAGE).toContain("<AgenticConsoleSimple");
    expect(PAGE).not.toContain("<AgenticControlTower");
  });

  it("the root page stays read-only (no execution controls)", () => {
    expect(PAGE).not.toContain("<form");
    expect(PAGE).not.toContain("<input");
    expect(PAGE).not.toContain("<button");
  });

  it("links to the detailed archive view", () => {
    expect(PAGE).toContain("/admin/agentic/detailed");
  });
});

describe("agentic detailed page — control tower composition", () => {
  it("the detailed page renders a single AgenticControlTower orchestrator", () => {
    expect(DETAILED_PAGE).toContain("<AgenticControlTower");
    expect(DETAILED_PAGE).toContain("controlCenter={controlCenter}");
    expect(DETAILED_PAGE).toContain("actionReadiness={actionReadiness}");
    expect(DETAILED_PAGE).toContain("crewSimulations={crewSimulations}");
  });

  it("the detailed page no longer renders the old card-wall map + inspector", () => {
    expect(DETAILED_PAGE).not.toContain("AgenticSystemMap");
    expect(DETAILED_PAGE).not.toContain("AgenticDetailInspector");
    expect(DETAILED_PAGE).not.toContain('aria-label="Agents and logic inventory"');
    expect(DETAILED_PAGE).not.toContain("SystemStatusChip");
  });

  it("the detailed page stays read-only (no execution controls)", () => {
    expect(DETAILED_PAGE).not.toContain("<form");
    expect(DETAILED_PAGE).not.toContain("<input");
    expect(DETAILED_PAGE).not.toContain("<button");
  });
});

describe("control tower — section order (overview first, details progressive)", () => {
  const order = [
    "AgenticStatusLine",
    "AgenticTopologyMap",
    "AgenticCapabilitiesBoard",
    "AgenticAgentsOverview",
    "ActionReadinessMatrixSection",
    "CrewSimulationSection",
    "RouterObservabilitySection",
    "AgenticSafetyBoundary",
  ];

  it("composes every required section", () => {
    for (const s of order) {
      expect(TOWER, `tower missing <${s}>`).toContain(`<${s}`);
    }
  });

  it("renders the status line before the topology", () => {
    const summaryIdx = TOWER.indexOf("<AgenticStatusLine");
    const topologyIdx = TOWER.indexOf("<AgenticTopologyMap");
    expect(summaryIdx).toBeGreaterThan(-1);
    expect(topologyIdx).toBeGreaterThan(summaryIdx);
  });

  it("renders the topology before the detail sections", () => {
    const topologyIdx = TOWER.indexOf("<AgenticTopologyMap");
    const obsIdx = TOWER.indexOf("<RouterObservabilitySection");
    expect(topologyIdx).toBeGreaterThan(-1);
    expect(obsIdx).toBeGreaterThan(topologyIdx);
  });

  it("preserves the core read-only data sections", () => {
    expect(TOWER).toContain("<ActionReadinessMatrixSection");
    expect(TOWER).toContain("<CrewSimulationSection");
    expect(TOWER).toContain("<RouterObservabilitySection");
    // ReportingCrewSection was merged into Observability — data not lost, section removed.
    expect(TOWER).not.toContain("<ReportingCrewSection");
  });
});
