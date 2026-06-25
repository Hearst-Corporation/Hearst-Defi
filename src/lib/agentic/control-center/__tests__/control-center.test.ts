import { describe, expect, it } from "vitest";

import {
  getAgenticInventory,
  getHumanGateInventory,
  getToolBoundarySummary,
  getPromptMap,
  getRouterStatusSummary,
  getSafetySummary,
} from "../index";

describe("agentic control center — inventory", () => {
  const inventory = getAgenticInventory();
  const names = inventory.map((i) => i.name.toLowerCase());

  const expectedCore = [
    "master agent",
    "outreach scorer",
    "outreach writer",
    "outreach reply handler",
    "scenario narrative",
    "investor memo",
    "mining health",
    "risk explanation",
    "memory distill",
    "product review",
    "compliance guards",
    "deterministic intent router",
  ];

  it.each(expectedCore)("contains %s", (needle) => {
    expect(names.some((n) => n.includes(needle))).toBe(true);
  });

  it("every item has at least one source path", () => {
    for (const item of inventory) {
      expect(item.paths.length).toBeGreaterThan(0);
      for (const p of item.paths) expect(p).toMatch(/\.(ts|tsx)$|\/$/);
    }
  });

  it("ids are unique", () => {
    const ids = inventory.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("agentic control center — human gates", () => {
  const gates = getHumanGateInventory();
  const ids = gates.map((g) => g.id);

  const expectedGates = [
    "deploy",
    "mark-live",
    "send-email",
    "source-leads",
    "db-migration",
    "formula-model-change",
  ];

  it.each(expectedGates)("contains gate %s", (gate) => {
    expect(ids).toContain(gate);
  });

  it("all critical gates are non-autonomous", () => {
    for (const g of gates) {
      expect(g.autonomousAllowed).toBe(false);
      expect(g.requiresAdmin).toBe(true);
      expect(g.requiresConfirmation).toBe(true);
    }
  });
});

describe("agentic control center — tool boundary", () => {
  const boundary = getToolBoundarySummary();

  it("covers all four categories", () => {
    const cats = boundary.map((b) => b.category).sort();
    expect(cats).toEqual(
      [
        "confirmed-write",
        "draft-proposal",
        "forbidden-autonomous",
        "read-only",
      ].sort(),
    );
  });

  it("read-only tier requires no confirmation; write tiers do", () => {
    for (const b of boundary) {
      if (b.category === "read-only") {
        expect(b.requiresConfirmation).toBe(false);
      } else {
        expect(b.requiresConfirmation).toBe(true);
      }
    }
  });

  it("forbidden tier lists deploy + db migration + safe signature", () => {
    const forbidden = boundary.find((b) => b.category === "forbidden-autonomous");
    const blob = forbidden?.items.join(" ").toLowerCase() ?? "";
    expect(blob).toContain("deploy");
    expect(blob).toContain("migration");
    expect(blob).toContain("signature");
  });
});

describe("agentic control center — prompt map", () => {
  const map = getPromptMap();
  const allPaths = map.flatMap((m) => m.paths);

  const expectedPaths = [
    "src/lib/llm/prompts.ts",
    "src/lib/llm/output-guard.ts",
    "src/lib/agents/forbidden-words.ts",
    "src/lib/agents/apy-range.ts",
  ];

  it.each(expectedPaths)("includes key file %s", (p) => {
    expect(allPaths).toContain(p);
  });

  it("every entry has a kind and a summary", () => {
    for (const m of map) {
      expect(["system", "agent", "canvas", "guard"]).toContain(m.kind);
      expect(m.summary.length).toBeGreaterThan(0);
    }
  });
});

describe("agentic control center — router status", () => {
  const router = getRouterStatusSummary();

  it("reports the deterministic router exists (v2)", () => {
    expect(router.deterministicRouterExists).toBe(true);
    expect(router.version).toMatch(/v2/i);
  });

  it("has navigation / negation / dangerous-refusal as active paths", () => {
    const active = router.routerPaths
      .filter((p) => p.mode === "active")
      .map((p) => p.id);
    expect(active).toContain("navigation");
    expect(active).toContain("negation");
    expect(active).toContain("dangerous-refusal");
  });

  it("has outreach / product-vault / reporting / readiness as shadow paths", () => {
    const shadow = router.routerPaths
      .filter((p) => p.mode === "shadow")
      .map((p) => p.id);
    expect(shadow).toEqual(
      expect.arrayContaining([
        "outreach",
        "product-vault-draft",
        "reporting",
        "readiness",
      ]),
    );
  });

  // --- Router stabilization final state (lot close) ----------------------

  it("is active and non-shadow", () => {
    expect(router.status).toBe("active");
    expect(router.mode).toBe("non-shadow");
  });

  it("reports AGENTIC_ROUTER_SHADOW as dead (zero references)", () => {
    expect(router.shadowFlag.name).toBe("AGENTIC_ROUTER_SHADOW");
    expect(router.shadowFlag.alive).toBe(false);
  });

  it("renders the verbatim Router Status block as specified", () => {
    const text = router.statusBlock.join("\n");
    expect(text).toContain("Status: active");
    expect(text).toContain("Mode: non-shadow");
    expect(text).toContain("navigation fast-path before LLM");
    expect(text).toContain("negation protection");
    expect(text).toContain("dangerous intent refusal before LLM/tool/write");
    expect(text).toContain("educational read-only steering");
    expect(text).toContain("Legacy fallback:");
    expect(text).toContain("- retained");
    expect(text).toContain("- gated by negation");
    expect(text).toContain("Guard:");
    expect(text).toContain("- not bypassed");
    expect(text).toContain("- prompt steering only");
    expect(text).toContain(
      "- forbidden/guaranteed/single-point APY still blocked",
    );
  });

  it("asserts the guard is never relaxed by the router (all hold)", () => {
    for (const a of router.guardAssertions) expect(a.holds).toBe(true);
    const ids = router.guardAssertions.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "guard-not-bypassed",
        "guard-no-intent-param",
        "forbidden-words-blocked",
        "guaranteed-yield-blocked",
        "single-point-apy-blocked",
        "no-hitl-token-on-refusal",
      ]),
    );
  });

  it("records the closed-lot release metadata", () => {
    expect(router.release.lotStatus).toBe("closed");
    expect(router.release.mergeCommit).toBe("bcb55f2c");
    expect(router.release.mergePr).toBe("#36");
    expect(router.release.lockReleaseCommit).toBe("49ce60cc");
    expect(router.release.lockReleasePr).toBe("#37");
    expect(router.release.vercel).toBe("ready");
  });

  it("every router-stabilization validation passed", () => {
    expect(router.release.validations.length).toBeGreaterThan(0);
    for (const v of router.release.validations) expect(v.pass).toBe(true);
    const labels = router.release.validations.map((v) => v.result);
    expect(labels).toContain("3055/3055");
  });
});

describe("agentic control center — safety summary", () => {
  const safety = getSafetySummary();

  it("every documented safety claim holds", () => {
    for (const s of safety) expect(s.holds).toBe(true);
  });

  it("asserts no autonomous deploy / send / mark-live / db migration", () => {
    const claims = safety.map((s) => s.id);
    expect(claims).toEqual(
      expect.arrayContaining([
        "no-autonomous-deploy",
        "no-autonomous-send",
        "no-autonomous-mark-live",
        "no-autonomous-db-migration",
        "hitl-enabled",
        "router-v2-active",
        "product-education-passes",
        "yield-education-passes",
      ]),
    );
  });
});
