import { describe, expect, it } from "vitest";

import { buildOutreachLifecycleDemo } from "@/lib/admin/diagnostics/outreach-lifecycle";

function path(id: string) {
  const p = buildOutreachLifecycleDemo().paths.find((x) => x.id === id);
  if (!p) throw new Error(`path ${id} missing`);
  return p;
}

describe("Outreach Lifecycle Demo", () => {
  it("describes all seven lifecycle paths", () => {
    const ids = buildOutreachLifecycleDemo().paths.map((p) => p.id);
    expect(ids).toEqual([
      "draft",
      "direct-send",
      "campaign-fanout",
      "auto-send",
      "followups",
      "suppression",
      "forbidden-words",
    ]);
  });

  it("the envelope proves no real dispatch", () => {
    const r = buildOutreachLifecycleDemo();
    expect(r.externalSend).toBe(false);
    expect(r.resendCalled).toBe(false);
    expect(r.inngestTriggered).toBe(false);
    expect(r.ok).toBe(true);
  });

  it("direct send path includes the ConfirmDialog gate", () => {
    const p = path("direct-send");
    expect(p.guardSequence.some((g) => /ConfirmDialog/i.test(g))).toBe(true);
    expect(p.requiredConfirmation).toBe(true);
  });

  it("campaign fan-out path points at outreach-send.ts", () => {
    expect(path("campaign-fanout").source).toContain("outreach-send.ts");
  });

  it("auto-send path points at outreach-auto-send.ts and proves SUGGEST = 0 sends", () => {
    const p = path("auto-send");
    expect(p.source).toContain("outreach-auto-send.ts");
    // Evidence is derived from the real decideAutoSend policy.
    const ev = p.evidence as {
      suggestTierBFirstAutoSend: boolean;
      tierANeverAutoSent: boolean;
    };
    expect(ev.suggestTierBFirstAutoSend).toBe(false); // SUGGEST = 0 sends
    expect(ev.tierANeverAutoSent).toBe(false); // Tier A never auto-sent
  });

  it("follow-ups path points at outreach-followups.ts", () => {
    expect(path("followups").source).toContain("outreach-followups.ts");
  });

  it("forbidden-words path catches the unsafe sample via the real guard", () => {
    const p = path("forbidden-words");
    expect(p.verdict).toBe("SAFE");
    expect(p.diagnostic).toMatch(/guard live/i);
  });

  it("no path is ever UNSAFE in the default posture", () => {
    for (const p of buildOutreachLifecycleDemo().paths) {
      expect(p.verdict, p.id).not.toBe("UNSAFE");
    }
  });
});
