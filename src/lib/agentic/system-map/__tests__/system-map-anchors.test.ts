import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Control Tower V2 — page + composition contract. The page renders a single
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
    // No 22-card inventory / inline status-chip sections left on the page.
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
    "AgenticCommandSummary",
    "AgenticSectionNav",
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

  it("renders the command summary + nav before the topology", () => {
    const summaryIdx = TOWER.indexOf("<AgenticCommandSummary");
    const navIdx = TOWER.indexOf("<AgenticSectionNav");
    const topologyIdx = TOWER.indexOf("<AgenticTopologyMap");
    expect(summaryIdx).toBeGreaterThan(-1);
    expect(navIdx).toBeGreaterThan(summaryIdx);
    expect(topologyIdx).toBeGreaterThan(navIdx);
  });

  it("renders the topology before the detail sections", () => {
    const topologyIdx = TOWER.indexOf("<AgenticTopologyMap");
    const obsIdx = TOWER.indexOf("<RouterObservabilitySection");
    const reportingIdx = TOWER.indexOf("<ReportingCrewSection");
    expect(topologyIdx).toBeGreaterThan(-1);
    expect(obsIdx).toBeGreaterThan(topologyIdx);
    expect(reportingIdx).toBeGreaterThan(topologyIdx);
  });

  it("preserves the read-only data sections (no data lost)", () => {
    expect(TOWER).toContain("<ActionReadinessMatrixSection");
    expect(TOWER).toContain("<CrewSimulationSection");
    expect(TOWER).toContain("<RouterObservabilitySection");
    expect(TOWER).toContain("<ReportingCrewSection");
  });
});
