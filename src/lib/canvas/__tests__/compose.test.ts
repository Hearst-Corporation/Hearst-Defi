/**
 * Canvas composer — non-negotiable pins:
 *  - every field carries a provenance badge (#2);
 *  - a "not guaranteed" disclaimer is always present (#10);
 *  - APY is shown as a range, never a single point (#1);
 *  - the create-vault proposal is draft-only, carries NO token, and is a real
 *    AdminWriteToolId in the create-vault allowlist;
 *  - the LP canvas surfaces ZERO write actions.
 */

import { describe, expect, it } from "vitest";

import { composeCanvasState } from "@/lib/canvas/compose";
import { canvasAllowsWriteTool } from "@/lib/canvas/registry";

describe("composeCanvasState — create-vault", () => {
  const state = composeCanvasState({
    canvasId: "create-vault",
    objective: "a new yield vault",
    revision: 1,
    agentLive: true,
  });

  it("always carries a not-guaranteed disclaimer", () => {
    expect(state.disclaimer.toLowerCase()).toContain("not guaranteed");
  });

  it("every field has a provenance badge", () => {
    const fields = state.sections.flatMap((s) => s.fields);
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) expect(f.provenance).toBeTruthy();
  });

  it("shows APY as a range, not a single point", () => {
    const apy = state.sections
      .flatMap((s) => s.fields)
      .find((f) => f.key === "targetApy");
    expect(apy?.value).toMatch(/\d+\s*-\s*\d+%/);
  });

  it("the only proposed action is a draft-only create_vault_draft with no token", () => {
    const actions = state.sections.flatMap((s) => s.actions);
    expect(actions).toHaveLength(1);
    const a = actions[0]!;
    expect(a.toolId).toBe("create_vault_draft");
    expect(canvasAllowsWriteTool("create-vault", a.toolId)).toBe(true);
    // INERT data: no token field exists on the proposal type/value.
    expect((a as unknown as Record<string, unknown>).token).toBeUndefined();
    expect((a as unknown as Record<string, unknown>).confirmedToken).toBeUndefined();
    // Honesty list mentions it does not go live.
    expect(a.willNotDo.join(" ").toLowerCase()).toContain("live");
    // PTAI present.
    expect(a.summary.projection).toBeTruthy();
    expect(a.summary.impact).toBeTruthy();
  });

  it("disables nothing structurally but reflects agentLive flag", () => {
    const off = composeCanvasState({ canvasId: "create-vault", revision: 1, agentLive: false });
    expect(off.agentLive).toBe(false);
  });
});

describe("composeCanvasState — lp-yield-explainer", () => {
  const state = composeCanvasState({
    canvasId: "lp-yield-explainer",
    revision: 1,
    agentLive: true,
  });

  it("is an lp-audience canvas with zero write actions", () => {
    expect(state.audience).toBe("lp");
    const actions = state.sections.flatMap((s) => s.actions);
    expect(actions).toHaveLength(0);
  });

  it("still carries provenance + disclaimer", () => {
    expect(state.disclaimer.toLowerCase()).toContain("not guaranteed");
    for (const f of state.sections.flatMap((s) => s.fields)) {
      expect(f.provenance).toBeTruthy();
    }
  });
});
