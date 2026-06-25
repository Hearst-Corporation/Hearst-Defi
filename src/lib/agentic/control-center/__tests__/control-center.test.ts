import { describe, expect, it } from "vitest";

import {
  getAgenticInventory,
  getHumanGateInventory,
  getToolBoundarySummary,
  getToolBoundaryV1Summary,
  getPromptMap,
  getRouterStatusSummary,
  getSafetySummary,
  getNextSteps,
  getAgenticControlCenterData,
} from "../index";

describe("agentic control center — inventory", () => {
  const inventory = getAgenticInventory();
  const names = inventory.map((i) => i.name.toLowerCase());

  // Spec-mandated minimum core items.
  const expectedCore = [
    "master agent / cockpit chat",
    "deterministic intent router",
    "tool registry",
    "hitl confirmations",
    "outreach writer",
    "outreach scorer",
    "outreach reply handler",
    "scenario narrative",
    "investor memo",
    "mining health",
    "risk explanation",
    "memory distill",
    "product review",
    "vault admin state machine",
  ];

  it.each(expectedCore)("contains %s", (needle) => {
    expect(names.some((n) => n.includes(needle))).toBe(true);
  });

  it("contains the three compliance guards", () => {
    expect(names.some((n) => n.includes("forbidden words"))).toBe(true);
    expect(names.some((n) => n.includes("apy range"))).toBe(true);
    expect(names.some((n) => n.includes("output guard"))).toBe(true);
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
    "mark_live",
    "send_email",
    "source_leads",
    "create_campaign",
    "create_vault_draft",
    "db_migration",
    "formula_change",
    "model_change",
    "governance_execute",
    "safe_signature",
  ];

  it.each(expectedGates)("contains gate %s", (gate) => {
    expect(ids).toContain(gate);
  });

  it("all critical gates are non-autonomous, admin + confirmation bound", () => {
    for (const g of gates) {
      expect(g.autonomousAllowed).toBe(false);
      expect(g.requiresHuman).toBe(true);
      expect(g.requiresAdmin).toBe(true);
      expect(g.requiresConfirmation).toBe(true);
    }
  });

  it("deploy / safe_signature / governance / db / formula / model are critical risk", () => {
    const critical = [
      "deploy",
      "safe_signature",
      "governance_execute",
      "db_migration",
      "formula_change",
      "model_change",
    ];
    for (const id of critical) {
      const g = gates.find((x) => x.id === id);
      expect(g?.riskLevel).toBe("critical");
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

  it("read-only tier lists the real read tools", () => {
    const readOnly = boundary.find((b) => b.category === "read-only");
    expect(readOnly?.items).toContain("outreach_list_prospects");
    expect(readOnly?.items).toContain("read_market_snapshot");
  });

  it("confirmed-write tier is only outreach_trigger_send_run", () => {
    const confirmed = boundary.find((b) => b.category === "confirmed-write");
    expect(confirmed?.items).toEqual(["outreach_trigger_send_run"]);
  });

  it("forbidden tier lists deploy + db migration + safe signature", () => {
    const forbidden = boundary.find((b) => b.category === "forbidden-autonomous");
    const blob = forbidden?.items.join(" ").toLowerCase() ?? "";
    expect(blob).toContain("deploy");
    expect(blob).toContain("migration");
    expect(blob).toContain("signature");
  });
});

describe("agentic control center — tool boundary v1 (reflection)", () => {
  const v1 = getToolBoundaryV1Summary();

  it("is a code reflection with per-tier counts + tools + safety notes", () => {
    expect(v1.source).toBe("code_reflection");
    expect(v1.tools.length).toBeGreaterThan(0);
    expect(v1.safetyNotes.length).toBeGreaterThan(0);
    expect(v1.counts.read_only).toBe(11);
    expect(v1.counts.confirmed_write).toBe(1);
    expect(v1.counts.draft_or_proposal).toBe(6);
    expect(v1.counts.unknown).toBe(0);
  });

  it("the static Control Center boundary is in sync with the real registry (no drift)", () => {
    // The static BOUNDARY lists exactly the real 11 read + 7 write ids, so there
    // should be no missing-in-static / stale-static warnings.
    const drift = v1.consistencyIssues.filter(
      (i) =>
        i.id.startsWith("missing-in-static:") || i.id.startsWith("stale-static:"),
    );
    expect(drift).toEqual([]);
  });

  it("has zero critical consistency issues (every write is gated + non-autonomous)", () => {
    expect(v1.consistencyIssues.filter((i) => i.severity === "critical")).toEqual(
      [],
    );
  });

  it("every reflected write tool requires a gate and is non-autonomous", () => {
    const writes = v1.tools.filter(
      (t) => t.tier === "draft_or_proposal" || t.tier === "confirmed_write",
    );
    expect(writes.length).toBe(7);
    for (const t of writes) {
      expect(t.humanGateRequired).toBe(true);
      expect(t.autonomousAllowed).toBe(false);
    }
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

  it("every entry has a kind + summary and is not editable in the UI", () => {
    for (const m of map) {
      expect([
        "system",
        "agent",
        "canvas",
        "guard",
        "methodology",
      ]).toContain(m.kind);
      expect(m.summary.length).toBeGreaterThan(0);
      expect(m.editableInUi).toBe(false);
    }
  });
});

describe("agentic control center — router status", () => {
  const router = getRouterStatusSummary();

  it("is active + non-shadow (v2)", () => {
    expect(router.deterministicRouterExists).toBe(true);
    expect(router.status).toBe("active");
    expect(router.mode).toBe("non-shadow");
    expect(router.version).toMatch(/v2/i);
  });

  it("has navigation / negation / dangerous-refusal / education as active paths", () => {
    const active = router.routerPaths
      .filter((p) => p.mode === "active")
      .map((p) => p.id);
    expect(active).toContain("navigation");
    expect(active).toContain("negation");
    expect(active).toContain("dangerous-refusal");
    expect(active).toContain("education-hint");
  });

  it("lists dangerous refusal in the policy + crew/swarms as shadow", () => {
    expect(router.dangerousIntentPolicy.toLowerCase()).toContain("refused");
    const shadow = router.routerPaths
      .filter((p) => p.mode === "shadow")
      .map((p) => p.id);
    expect(shadow).toEqual(
      expect.arrayContaining(["crew-runtime", "external-swarms"]),
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

  it("asserts no autonomous deploy / send / source / mark-live / db migration", () => {
    const claims = safety.map((s) => s.id);
    expect(claims).toEqual(
      expect.arrayContaining([
        "no-autonomous-deploy",
        "no-autonomous-send",
        "no-autonomous-source",
        "no-autonomous-mark-live",
        "no-autonomous-db-migration",
        "no-autonomous-safe-governance",
        "hitl-enabled",
        "compliance-guard-active",
        "router-v2-active",
        "product-education-passes",
        "yield-education-passes",
      ]),
    );
  });
});

describe("agentic control center — next steps", () => {
  const steps = getNextSteps();

  it("returns planned-only roadmap items", () => {
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) expect(s.status).toBe("planned");
  });
});

describe("agentic control center — data aggregator", () => {
  const data = getAgenticControlCenterData();

  it("returns all sections", () => {
    expect(data.router).toBeDefined();
    expect(data.inventory.length).toBeGreaterThan(0);
    expect(data.gates.length).toBeGreaterThan(0);
    expect(data.tools.length).toBe(4);
    expect(data.prompts.length).toBeGreaterThan(0);
    expect(data.safetySummary.length).toBeGreaterThan(0);
    expect(data.nextSteps.length).toBeGreaterThan(0);
  });

  it("includes the Tool Boundary v1 reflection (additive, backward-compatible)", () => {
    expect(data.toolBoundaryV1).toBeDefined();
    expect(data.toolBoundaryV1!.source).toBe("code_reflection");
    expect(data.toolBoundaryV1!.tools.length).toBeGreaterThan(0);
    // legacy static tier list is still present and unchanged
    expect(data.tools.length).toBe(4);
  });

  it("is a static registry marker, not a live timestamp", () => {
    expect(data.version).toBe("v0.1");
    expect(data.generatedAt.toLowerCase()).toContain("static");
  });
});
