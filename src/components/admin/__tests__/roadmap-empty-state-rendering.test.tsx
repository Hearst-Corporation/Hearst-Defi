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
}

describe("Admin roadmap — design contract", () => {
  it("RoadmapItemRow uses NestedPanel, not ad-hoc ct-surface-1 shell", () => {
    const html = renderToStaticMarkup(<RoadmapItemRow item={sampleItem} />);
    expect(html).toContain("ct-nested-panel");
    expect(html).not.toMatch(/rounded-xl border border-\[var\(--ct-border\)\] ct-surface-1/);
  });

  it("empty phases: EmptySurface widget replaces phase list shell", () => {
    const html = renderToStaticMarkup(
      <RoadmapBoard phases={[]} mvpPhase={undefined} />,
    );
    assertEmptyDesignContract(html, "No roadmap phases configured.");
    expect(html).toContain("ct-empty-surface--widget");
    expect(html).not.toContain("ct-card glass-panel");
  });

  it("empty week: EmptySurface widget replaces Card shell (no header when no items)", () => {
    const html = renderToStaticMarkup(
      <RoadmapBoard
        phases={[
          {
            ...samplePhase,
            weeks: [{ ...sampleWeek, items: [], total: 0, doneCount: 0 }],
          },
        ]}
      />,
    );
    assertEmptyDesignContract(html, "No roadmap items in this sprint week.");
    expect(html).not.toContain("ct-card glass-panel");
  });

  it("active week: Card shell with nested item rows", () => {
    const html = renderToStaticMarkup(
      <RoadmapBoard phases={[samplePhase]} mvpPhase={samplePhase} />,
    );
    expect(html).toContain("ct-card glass-panel");
    expect(html).toContain("ct-nested-panel");
    expect(html).toContain("MVP progress");
    expect(html).not.toContain("ct-empty-surface--widget");
  });

  it("phase with no weeks: inline empty under active phase header", () => {
    const html = renderToStaticMarkup(
      <RoadmapBoard
        phases={[{ ...samplePhase, weeks: [], total: 0, doneCount: 0 }]}
      />,
    );
    expect(html).toContain("ct-empty-surface--inline");
    expect(html).toContain("No sprint weeks in this phase.");
    expect(html).toContain('class="h2"');
  });
});
