/**
 * ActionReadinessMatrixSection — read-only render contract.
 *
 * Verifies the four tier lanes, action rows with risk badges, and that NO
 * write/action controls exist (no <button>, <form>, <input>, no run/send/deploy).
 * SSR render (repo convention).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActionReadinessMatrixSection } from "@/components/admin/agentic/action-readiness-matrix-section";
import { buildActionReadinessMatrix } from "@/lib/agentic/action-readiness";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";

const MATRIX: ActionReadinessMatrix = buildActionReadinessMatrix("static");

function render(m: ActionReadinessMatrix | null | undefined): string {
  return renderToStaticMarkup(<ActionReadinessMatrixSection matrix={m} />);
}

const NO_WRITE_CONTROLS = (html: string) => {
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<input");
};

describe("ActionReadinessMatrixSection", () => {
  it("renders heading and section", () => {
    const html = render(MATRIX);
    expect(html).toContain("Actions");
    expect(html).toContain("Gates");
    NO_WRITE_CONTROLS(html);
  });

  it("renders the four tier lanes with data-tier attributes", () => {
    const html = render(MATRIX);
    expect(html).toContain('data-tier="read_only"');
    expect(html).toContain('data-tier="draft_or_proposal"');
    expect(html).toContain('data-tier="confirmed_write"');
    expect(html).toContain('data-tier="forbidden_autonomous"');
    NO_WRITE_CONTROLS(html);
  });

  it("renders tier lane labels", () => {
    const html = render(MATRIX);
    expect(html).toContain("Read-only");
    expect(html).toContain("Draft / Proposal");
    expect(html).toContain("Confirmed-write");
    expect(html).toContain("Forbidden");
    NO_WRITE_CONTROLS(html);
  });

  it("renders action item names", () => {
    const html = render(MATRIX);
    // At least some action labels from the matrix appear
    const readOnlyItems = MATRIX.items.filter(i => i.tier === "read_only");
    expect(readOnlyItems.length).toBeGreaterThan(0);
    expect(html).toContain(readOnlyItems[0]!.label);
  });

  it("renders risk badges for non-low risk items", () => {
    const html = render(MATRIX);
    const highRisk = MATRIX.items.find(i => i.riskLevel === "high" || i.riskLevel === "critical");
    if (highRisk) {
      expect(html).toContain(highRisk.riskLevel);
    }
    NO_WRITE_CONTROLS(html);
  });

  it("renders item counts in lane headers", () => {
    const html = render(MATRIX);
    expect(html).toContain(String(MATRIX.counts.read_only));
    expect(html).toContain(String(MATRIX.counts.forbidden_autonomous));
  });

  it("has no actionable run/send/deploy controls", () => {
    const html = render(MATRIX).toLowerCase();
    expect(html).not.toContain("<button");
    expect(html).not.toContain('type="submit"');
  });

  it("renders nothing when matrix is null/undefined", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });
});
