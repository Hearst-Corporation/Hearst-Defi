import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildAgenticSystemMap } from "@/lib/agentic/system-map";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";

// Page-integration contract: every node detailHref anchor the map emits must map
// to a real section anchor (id=...) in the admin page, so jump-links resolve.
// This guards the map↔page wiring without rendering the async server component.

const PAGE = readFileSync(
  join(process.cwd(), "src/app/admin/agentic/page.tsx"),
  "utf8",
);

function pageHasAnchor(id: string): boolean {
  // Anchors live either as id="..." on the page OR as a component-rendered id
  // (router-observability, router-quality-review, tool-boundary-v1, reporting-crew
  // are rendered by their own components with those ids).
  const componentAnchors = new Set([
    "router-observability",
    "router-quality-review",
    "tool-boundary-v1",
    "reporting-crew",
  ]);
  if (componentAnchors.has(id)) return true;
  return PAGE.includes(`id="${id}"`);
}

describe("system map — page anchor contract", () => {
  const map = buildAgenticSystemMap({
    controlCenter: getAgenticControlCenterData(),
    observability: null,
    reporting: null,
  });

  it("every node detailHref resolves to a real page/component anchor", () => {
    for (const node of map.nodes) {
      if (!node.detailHref) continue;
      const id = node.detailHref.replace(/^#/, "");
      expect(pageHasAnchor(id), `node ${node.id} → #${id} has no anchor`).toBe(true);
    }
  });

  it("the page renders the visual map and detail inspector first", () => {
    expect(PAGE).toContain("<AgenticSystemMap map={systemMap} />");
    expect(PAGE).toContain("<AgenticDetailInspector map={systemMap} />");
    // Map appears before the legacy "System status" section.
    const mapIdx = PAGE.indexOf("<AgenticSystemMap");
    const statusIdx = PAGE.indexOf('aria-label="System status"');
    expect(mapIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeGreaterThan(-1);
    expect(mapIdx).toBeLessThan(statusIdx);
  });

  it("the page preserves the existing detail sections", () => {
    expect(PAGE).toContain("<RouterObservabilitySection");
    expect(PAGE).toContain("<ReportingCrewSection");
    expect(PAGE).toContain("<ToolBoundarySection");
    expect(PAGE).toContain('id="human-gates"');
    expect(PAGE).toContain('id="agents-inventory"');
    expect(PAGE).toContain('id="prompt-map"');
    expect(PAGE).toContain('id="compliance-guards"');
  });
});
