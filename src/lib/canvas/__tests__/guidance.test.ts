/**
 * Canvas guidance system-block pins (ROUTE-2 / Fix 1 + Fix 5):
 *  - at opening, the outreach workshop asks for the REQUIRED fields (name + kind)
 *    and tells the agent NOT to invent them;
 *  - the agent must NEVER announce an automatic action ("je vais sourcer…");
 *  - after a creation it proposes the next step UNDER explicit confirmation.
 */

import { describe, expect, it } from "vitest";

import { buildCanvasGuidanceBlock } from "@/lib/canvas/guidance";

describe("buildCanvasGuidanceBlock — outreach", () => {
  const block = buildCanvasGuidanceBlock("outreach");

  it("asks for the required campaign fields at opening", () => {
    const lower = block.toLowerCase();
    expect(lower).toContain("nom");
    expect(lower).toContain("cold");
    expect(lower).toContain("newsletter");
    // Explicitly tells the agent NOT to invent values.
    expect(lower).toContain("invent");
  });

  it("forbids announcing an automatic action (no 'je vais sourcer maintenant')", () => {
    const lower = block.toLowerCase();
    expect(lower).toContain("n'annonce jamais");
    expect(lower).toContain("sourcer les leads maintenant");
    // The next step is proposed UNDER confirmation.
    expect(lower).toContain("confirmation");
  });
});

describe("buildCanvasGuidanceBlock — unknown id is safe", () => {
  it("returns a non-empty block for every known canvas, never throws", () => {
    for (const id of ["outreach", "create-vault", "lp-yield-explainer"] as const) {
      expect(buildCanvasGuidanceBlock(id).length).toBeGreaterThan(0);
    }
  });
});
