/**
 * ActionReadinessMatrixSection — read-only render contract.
 *
 * Verifies the tier count cards, the four tier lanes, action chips with
 * autonomous/gate/risk badges, and the safety notes — with NO write/action
 * controls (no <button>, <form>, <input>, no run/send/deploy/source). SSR render.
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
  it("renders heading + read-only badge + action count", () => {
    const html = render(MATRIX);
    expect(html).toContain("Action Readiness");
    expect(html).toContain("read-only");
    expect(html).toContain("21 actions");
    NO_WRITE_CONTROLS(html);
  });

  it("renders the four tier lanes with labels", () => {
    const html = render(MATRIX);
    expect(html).toContain("Read-only");
    expect(html).toContain("Draft / Proposal");
    expect(html).toContain("Confirmed-write");
    expect(html).toContain("Forbidden-autonomous");
    // tier lane data-attributes for CSS
    expect(html).toContain('data-tier="read_only"');
    expect(html).toContain('data-tier="forbidden_autonomous"');
    NO_WRITE_CONTROLS(html);
  });

  it("renders action chips with autonomous / HITL / risk badges", () => {
    const html = render(MATRIX);
    expect(html).toContain("autonomous");
    expect(html).toContain("non-autonomous");
    expect(html).toContain("HITL");
    NO_WRITE_CONTROLS(html);
  });

  it("renders the tier count cards", () => {
    const html = render(MATRIX);
    // counts 7 / 5 / 1 / 8 appear
    expect(html).toContain(String(MATRIX.counts.read_only));
    expect(html).toContain(String(MATRIX.counts.forbidden_autonomous));
  });

  it("renders the safety notes", () => {
    const html = render(MATRIX);
    expect(html).toContain("Safety");
    expect(html).toMatch(/forbidden_autonomous|never callable|hard-blocked|autonomous/i);
    NO_WRITE_CONTROLS(html);
  });

  it("has no actionable run/send/deploy controls", () => {
    const html = render(MATRIX).toLowerCase();
    // No actionable control elements (words may appear in descriptive text).
    expect(html).not.toContain("<button");
    expect(html).not.toContain('type="submit"');
  });

  it("renders nothing when matrix is null/undefined", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });
});
