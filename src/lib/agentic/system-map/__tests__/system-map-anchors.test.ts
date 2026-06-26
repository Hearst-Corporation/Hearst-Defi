import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Control Tower — page + composition contract. The page renders a single
// <AgenticControlTower> orchestrator; the tower composes the sections in the
// map-first / details-progressive order. These string-level checks guard the
// information architecture without rendering the async server component.

const PAGE = readFileSync(
  join(process.cwd(), "src/app/admin/agentic/page.tsx"),
  "utf8",
);
const TOWER = readFileSync(
  join(
    process.cwd(),
    "src/components/admin/agentic/agentic-control-tower.tsx",
  ),
  "utf8",
);

describe("agentic page — control tower composition", () => {
  it("the page renders a single AgenticControlTower orchestrator", () => {
    expect(PAGE).toContain("<AgenticControlTower");
    expect(PAGE).toContain("controlCenter={controlCenter}");
    expect(PAGE).toContain("actionReadiness={actionReadiness}");
    expect(PAGE).toContain("crewSimulations={crewSimulations}");
  });

  it("the page no longer renders the old card-wall map + inspector", () => {
    expect(PAGE).not.toContain("AgenticSystemMap");
    expect(PAGE).not.toContain("AgenticDetailInspector");
    expect(PAGE).not.toContain('aria-label="Agents and logic inventory"');
    expect(PAGE).not.toContain("SystemStatusChip");
  });

  it("the page stays read-only (no execution controls)", () => {
    expect(PAGE).not.toContain("<form");
    expect(PAGE).not.toContain("<input");
    expect(PAGE).not.toContain("<button");
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
