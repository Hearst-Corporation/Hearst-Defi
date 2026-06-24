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

import {
  composeCanvasState,
  deriveOutreachValuesFromObjective,
} from "@/lib/canvas/compose";
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

describe("composeCanvasState — outreach", () => {
  // With required fields supplied, the create-campaign-draft proposal is present.
  const state = composeCanvasState({
    canvasId: "outreach",
    objective: "distributor campaign",
    revision: 1,
    agentLive: true,
    values: { name: "Distributor Q3", kind: "cold" },
  });

  it("proposes only allowlisted outreach write tools", () => {
    const toolIds = state.sections.flatMap((s) => s.actions).map((a) => a.toolId);
    for (const id of toolIds) {
      expect(canvasAllowsWriteTool("outreach", id)).toBe(true);
    }
    expect(toolIds).toContain("create_campaign_draft");
  });

  it("the send-run proposal spells out Tier-A-never + autonomy ceiling", () => {
    const send = state.sections
      .flatMap((s) => s.actions)
      .find((a) => a.toolId === "outreach_trigger_send_run");
    expect(send).toBeTruthy();
    const willNotDo = send!.willNotDo.join(" ").toLowerCase();
    expect(willNotDo).toContain("tier a");
    expect(willNotDo).toContain("autonomy");
  });

  it("never proposes a vault tool from the outreach canvas", () => {
    const toolIds = state.sections.flatMap((s) => s.actions).map((a) => a.toolId);
    expect(toolIds).not.toContain("create_vault_draft");
  });

  it("carries provenance + disclaimer like every canvas", () => {
    expect(state.disclaimer.toLowerCase()).toContain("not guaranteed");
    for (const f of state.sections.flatMap((s) => s.fields)) {
      expect(f.provenance).toBeTruthy();
    }
  });

  // ROUTE-2 gating: the create_campaign_draft proposal must NOT be surfaced
  // until BOTH required fields (name + valid kind) are present.
  it("does NOT propose create_campaign_draft when no values are supplied", () => {
    const empty = composeCanvasState({
      canvasId: "outreach",
      objective: "lance une campagne outreach distributeurs institutionnels",
      revision: 1,
      agentLive: true,
    });
    const toolIds = empty.sections.flatMap((s) => s.actions).map((a) => a.toolId);
    expect(toolIds).not.toContain("create_campaign_draft");
    // The campaign section signals that fields are still required.
    const campaignSection = empty.sections.find((s) => s.id === "outreach-campaign");
    expect(campaignSection?.status).toBe("building");
    expect(campaignSection?.intro?.toLowerCase()).toContain("required");
  });

  it("does NOT propose create_campaign_draft when only the kind is present (name missing path)", () => {
    const kindOnly = composeCanvasState({
      canvasId: "outreach",
      objective: "x",
      revision: 1,
      agentLive: true,
      values: { kind: "cold" }, // no name → still gated
    });
    const toolIds = kindOnly.sections.flatMap((s) => s.actions).map((a) => a.toolId);
    expect(toolIds).not.toContain("create_campaign_draft");
  });

  // Fix D — the gating hole: a name with NO explicit kind must stay gated. The
  // old code defaulted kind to "cold", so the button appeared the moment a name
  // was extracted (or hallucinated), with a kind the operator never chose.
  it("does NOT propose create_campaign_draft when the name is present but kind was never chosen", () => {
    const kindless = composeCanvasState({
      canvasId: "outreach",
      objective: "x",
      revision: 1,
      agentLive: true,
      values: { name: "Distributeurs Institutionnels" }, // explicit name, NO kind
    });
    const toolIds = kindless.sections.flatMap((s) => s.actions).map((a) => a.toolId);
    expect(toolIds).not.toContain("create_campaign_draft");
    // The kind field must not fabricate a "cold" choice the operator never made.
    const kindField = kindless.sections
      .flatMap((s) => s.fields)
      .find((f) => f.key === "kind");
    expect(kindField?.value).toBe("—");
    // Still "building" — awaiting the kind.
    expect(
      kindless.sections.find((s) => s.id === "outreach-campaign")?.status,
    ).toBe("building");
  });

  // Opening turn (no name, no kind): the WHOLE canvas must be inert — no campaign
  // draft, no source-leads, no send-run. Nothing actionable before the campaign is
  // named + typed (addresses "progression UX trop agressive").
  it("surfaces ZERO write actions on the opening turn", () => {
    const opening = composeCanvasState({
      canvasId: "outreach",
      objective:
        "lance une campagne outreach distributeurs institutionnels pour Hearst Yield",
      revision: 1,
      agentLive: true,
    });
    const actions = opening.sections.flatMap((s) => s.actions);
    expect(actions).toHaveLength(0);
  });

  it("proposes create_campaign_draft with the exact name once both fields are present", () => {
    const action = state.sections
      .flatMap((s) => s.actions)
      .find((a) => a.toolId === "create_campaign_draft");
    expect(action).toBeTruthy();
    expect(action?.input).toMatchObject({ name: "Distributor Q3", kind: "cold" });
    expect(state.sections.find((s) => s.id === "outreach-campaign")?.status).toBe("ready");
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

describe("deriveOutreachValuesFromObjective — WIRE-1 remount survival", () => {
  it("extracts name + kind from a French quoted objective", () => {
    const v = deriveOutreachValuesFromObjective(
      'crée un draft de campagne nommée "Distributeurs Institutionnels Q3", type cold',
    );
    expect(v).toEqual({ name: "Distributeurs Institutionnels Q3", kind: "cold" });
  });

  it("extracts newsletter kind and an English 'named' objective", () => {
    const v = deriveOutreachValuesFromObjective('campaign named "Family Offices EMEA" newsletter');
    expect(v).toEqual({ name: "Family Offices EMEA", kind: "newsletter" });
  });

  it("returns undefined when nothing is extractable (e.g. a bare label)", () => {
    expect(deriveOutreachValuesFromObjective("Create campaign draft")).toBeUndefined();
    expect(deriveOutreachValuesFromObjective(undefined)).toBeUndefined();
  });

  // Fix C — the opening message names no campaign and chooses no kind, so the
  // canonical extractor must return undefined: it never invents a name from a
  // generic objective (the retired LLM extractor surfaced "distributeurs
  // institutionnels" as the campaign name).
  it("returns undefined for the opening outreach message (never invents a name)", () => {
    expect(
      deriveOutreachValuesFromObjective(
        "lance une campagne outreach distributeurs institutionnels pour Hearst Yield",
      ),
    ).toBeUndefined();
  });

  it("rebuilds the create_campaign_draft proposal with the real name/kind on remount", () => {
    // The degraded autostart path composes from the objective alone. With the
    // derived values, the recomposed proposal must carry the operator's name/kind
    // (not an empty name) so the 'Create campaign draft' button survives a remount.
    const values = deriveOutreachValuesFromObjective(
      'crée un draft de campagne nommée "Distributeurs Institutionnels Q3", type cold',
    );
    const state = composeCanvasState({
      canvasId: "outreach",
      objective: 'crée un draft de campagne nommée "Distributeurs Institutionnels Q3", type cold',
      revision: 1,
      agentLive: true,
      ...(values ? { values } : {}),
    });
    const action = state.sections
      .flatMap((s) => s.actions)
      .find((a) => a.toolId === "create_campaign_draft");
    expect(action).toBeTruthy();
    expect(action?.input).toMatchObject({ name: "Distributeurs Institutionnels Q3", kind: "cold" });
  });
});
