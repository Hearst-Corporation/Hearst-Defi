/**
 * Canvas awareness — guidance block, cross-turn memory markers, and field fill.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import { buildCanvasGuidanceBlock } from "@/lib/canvas/guidance";
import {
  canvasOpenMarker,
  stripCanvasOpenMarker,
  detectActiveCanvasFromHistory,
} from "@/lib/canvas/intent";
import { composeCanvasState } from "@/lib/canvas/compose";

describe("buildCanvasGuidanceBlock", () => {
  it("describes the outreach workshop steps + guardrails", () => {
    const b = buildCanvasGuidanceBlock("outreach");
    expect(b).toContain("ATELIER CANVAS ACTIF");
    expect(b.toLowerCase()).toContain("tier a");
    expect(b.toLowerCase()).toContain("campagne");
    // The follow-up instruction is the whole point of this block.
    expect(b.toLowerCase()).toContain("on commence comment");
  });
  it("restates draft-only for create-vault", () => {
    expect(buildCanvasGuidanceBlock("create-vault").toLowerCase()).toContain("brouillon");
  });
  it("LP canvas guidance is read-only with no actions", () => {
    expect(buildCanvasGuidanceBlock("lp-yield-explainer").toLowerCase()).toContain("lecture seule");
  });
});

describe("canvas open-marker (cross-turn memory)", () => {
  it("round-trips: marker is detectable then strippable", () => {
    const marker = canvasOpenMarker("outreach");
    const assistantTurn = `Voici la campagne.\n${marker}`;
    expect(detectActiveCanvasFromHistory([{ role: "assistant", content: assistantTurn }])).toBe("outreach");
    expect(stripCanvasOpenMarker(assistantTurn)).toBe("Voici la campagne.");
    expect(stripCanvasOpenMarker(assistantTurn)).not.toContain("canvas-open");
  });

  it("returns the MOST RECENT canvas marker, ignoring user turns", () => {
    const history = [
      { role: "assistant", content: `x ${canvasOpenMarker("create-vault")}` },
      { role: "user", content: "on commence comment" },
      { role: "assistant", content: `y ${canvasOpenMarker("outreach")}` },
    ];
    expect(detectActiveCanvasFromHistory(history)).toBe("outreach");
  });

  it("returns null when no marker is present", () => {
    expect(detectActiveCanvasFromHistory([{ role: "assistant", content: "hi" }])).toBeNull();
    expect(detectActiveCanvasFromHistory([])).toBeNull();
  });
});

describe("composeCanvasState — outreach field fill", () => {
  it("merges agent values into the displayed fields AND the action input", () => {
    const state = composeCanvasState({
      canvasId: "outreach",
      revision: 3,
      agentLive: true,
      values: { name: "Distributeurs Q3", kind: "newsletter" },
    });
    const nameField = state.sections.flatMap((s) => s.fields).find((f) => f.key === "name");
    expect(nameField?.value).toBe("Distributeurs Q3");
    const kindField = state.sections.flatMap((s) => s.fields).find((f) => f.key === "kind");
    expect(kindField?.value).toBe("newsletter");
    const campaignAction = state.sections
      .flatMap((s) => s.actions)
      .find((a) => a.toolId === "create_campaign_draft");
    expect((campaignAction?.input as { name?: string }).name).toBe("Distributeurs Q3");
    expect((campaignAction?.input as { kind?: string }).kind).toBe("newsletter");
  });

  it("falls back to placeholders with no values (unchanged behaviour)", () => {
    const state = composeCanvasState({ canvasId: "outreach", revision: 1, agentLive: true });
    const nameField = state.sections.flatMap((s) => s.fields).find((f) => f.key === "name");
    expect(nameField?.value).toBe("—");
  });
});
