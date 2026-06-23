/**
 * Canvas intent detection. A canvas only opens on the explicit preset marker;
 * the marker is stripped from the message the model + transcript see.
 */

import { describe, expect, it } from "vitest";

import { detectCanvasIntent } from "@/lib/canvas/intent";

describe("detectCanvasIntent", () => {
  it("detects a known canvas marker and strips it", () => {
    const r = detectCanvasIntent("[[canvas:create-vault]] Help me make a vault.");
    expect(r?.canvasId).toBe("create-vault");
    expect(r?.cleanedMessage).toBe("Help me make a vault.");
    expect(r?.cleanedMessage).not.toContain("[[canvas");
  });

  it("returns null when there is no marker (free-typed message)", () => {
    expect(detectCanvasIntent("How does the yield work?")).toBeNull();
  });

  it("returns null for an unknown canvas id", () => {
    expect(detectCanvasIntent("[[canvas:delete-everything]] do it")).toBeNull();
  });

  it("detects the LP read canvas marker", () => {
    const r = detectCanvasIntent("[[canvas:lp-yield-explainer]] explain please");
    expect(r?.canvasId).toBe("lp-yield-explainer");
  });

  it("is case-insensitive on the marker keyword", () => {
    const r = detectCanvasIntent("[[Canvas:create-vault]] x");
    expect(r?.canvasId).toBe("create-vault");
  });
});
