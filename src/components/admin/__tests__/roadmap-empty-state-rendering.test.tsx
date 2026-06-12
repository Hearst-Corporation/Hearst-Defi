/**
 * Admin roadmap empty-state rendering — structural contract (DS §9).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RoadmapBoard } from "@/components/admin/roadmap-board";
import { RoadmapItemRow } from "@/components/admin/roadmap-item-row";
import type { RoadmapItemWithState, RoadmapPhaseWithState } from "@/lib/roadmap-types";

const sampleItem: RoadmapItemWithState = {
  id: "test-item",
  label: "Sample deliverable",
  owner: "engine",
  spec_ref: "01-dashboard",
  status: "todo",
  validatedBy: null,
  validatedAt: null,
  notes: null,
  blockers: null,
  evidenceUrl: null,
  updatedAt: null,
};

const sampleWeek: RoadmapPhaseWithState["weeks"][number] = {
  id: "w1",
  label: "Week 1",
  total: 1,
  doneCount: 0,
  items: [sampleItem],
};

const samplePhase: RoadmapPhaseWithState = {
  id: "mvp",
  label: "MVP",
  total: 1,
  doneCount: 0,
  weeks: [sampleWeek],
};

function assertEmptyDesignContract(html: string, message: string): void {
  expect(html).toContain(message);
  expect(html).toContain("ct-empty-surface");
  expect(html).not.toContain("border-dashed");
  expect(html).not.toContain("pf-empty-chart");
  expect(html).not.toContain("pf-empty-widget");
  expect(html).not.toContain("ct-system-panel");
}

describe("Admin roadmap — design contract", () => {
  it("RoadmapItemRow uses flat list row without nested graphite shell", () => {
    const html = renderToStaticMarkup(<RoadmapItemRow item={sampleItem} />);
    expect(html).toContain("ct-roadmap-item-row");
    expect(html).not.toContain("ct-nested-panel");
    expect(html).not.toContain("ct-surface-1 rounded-xl");
    expect(html).not.toContain("border-dashed");
  });

  it("empty phases: EmptySurface widget replaces phase list shell", () => {
    const html = renderToStaticMarkup(<RoadmapBoard phases={[]} />);
    assertEmptyDesignContract(html, "No roadmap phases configured.");
    expect(html).toContain("ct-empty-surface--widget");
    expect(html).not.toContain("ct-card ct-glass-panel");
  });

  it("empty week: EmptySurface widget replaces week Card shell", () => {
    const html = renderToStaticMarkup(
      <RoadmapBoard
        phases={[
          {
            id: "phase-2",
            label: "Phase 2",
            total: 0,
            doneCount: 0,
            weeks: [
              {
                ...sampleWeek,
                items: [],
                total: 0,
                doneCount: 0,
              },
            ],
          },
        ]}
      />,
    );
    assertEmptyDesignContract(
      html,
      "Week 1 — no roadmap items configured.",
    );
    expect(html).not.toMatch(/ct-card ct-glass-panel[^>]*aria-label="Week 1"/);
  });

  it("active week: Card shell with flat divided item rows", () => {
    const html = renderToStaticMarkup(
      <RoadmapBoard phases={[samplePhase]} />,
    );
    expect(html).toContain("ct-card ct-glass-panel");
    expect(html).toContain("ct-roadmap-item-row");
    expect(html).not.toContain("ct-nested-panel");
    expect(html).toContain("MVP progress");
    expect(html).not.toContain("ct-empty-surface--widget");
  });

  it("phase with no weeks: PanelStatus inline under active phase header", () => {
    const html = renderToStaticMarkup(
      <RoadmapBoard
        phases={[{ ...samplePhase, weeks: [], total: 0, doneCount: 0 }]}
      />,
    );
    expect(html).toContain("ct-panel-status");
    expect(html).toContain("No sprint weeks in this phase.");
    expect(html).toContain('class="h2"');
  });
});
