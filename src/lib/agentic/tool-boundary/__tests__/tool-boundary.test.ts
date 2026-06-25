import { describe, expect, it } from "vitest";

import {
  ADMIN_READ_TOOL_IDS,
  ADMIN_WRITE_TOOL_IDS,
} from "@/lib/llm/tools/types";
import {
  reflectRealToolIds,
  REFLECTED_TOOL_META,
  classifyReflectedTool,
  classifyAllTools,
  FORBIDDEN_AUTONOMOUS_ACTIONS,
  checkToolBoundaryConsistency,
  buildToolBoundaryV1Summary,
  countByTier,
} from "@/lib/agentic/tool-boundary";

// These tests pin the reflection to the REAL registry id arrays. They never call
// a tool handler — registry-reflection.ts only imports the pure id arrays.

describe("registry reflection — completeness vs real ids", () => {
  it("reflects exactly the real read + write tool ids, reads first", () => {
    const reflected = reflectRealToolIds();
    const reads = reflected.filter((t) => t.kind === "read").map((t) => t.id);
    const writes = reflected.filter((t) => t.kind === "write").map((t) => t.id);
    expect(reads).toEqual([...ADMIN_READ_TOOL_IDS]);
    expect(writes).toEqual([...ADMIN_WRITE_TOOL_IDS]);
    // reads come before writes
    expect(reflected.slice(0, reads.length).every((t) => t.kind === "read")).toBe(
      true,
    );
  });

  it("has curated metadata for EVERY real tool id (no drift)", () => {
    for (const id of [...ADMIN_READ_TOOL_IDS, ...ADMIN_WRITE_TOOL_IDS]) {
      expect(REFLECTED_TOOL_META[id], `missing meta for ${id}`).toBeDefined();
    }
  });

  it("has NO extra metadata entries beyond the real ids", () => {
    const realIds = new Set<string>([
      ...ADMIN_READ_TOOL_IDS,
      ...ADMIN_WRITE_TOOL_IDS,
    ]);
    for (const id of Object.keys(REFLECTED_TOOL_META)) {
      expect(realIds.has(id), `extra meta for ${id}`).toBe(true);
    }
  });

  it("metadata kind matches the id array it came from", () => {
    for (const id of ADMIN_READ_TOOL_IDS) {
      expect(REFLECTED_TOOL_META[id]!.kind).toBe("read");
    }
    for (const id of ADMIN_WRITE_TOOL_IDS) {
      expect(REFLECTED_TOOL_META[id]!.kind).toBe("write");
    }
  });

  it("no duplicate tool ids across the reflection", () => {
    const ids = reflectRealToolIds().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exactly one write tool has an external effect (outreach_trigger_send_run)", () => {
    const external = ADMIN_WRITE_TOOL_IDS.filter(
      (id) => REFLECTED_TOOL_META[id]!.externalEffect,
    );
    expect(external).toEqual(["outreach_trigger_send_run"]);
  });
});

describe("classification — tiers + gates + risk", () => {
  it("classifies read tools as read_only, autonomous-allowed, no gate", () => {
    for (const id of ADMIN_READ_TOOL_IDS) {
      const item = classifyReflectedTool({
        id,
        kind: "read",
        meta: REFLECTED_TOOL_META[id],
      });
      expect(item.tier).toBe("read_only");
      expect(item.autonomousAllowed).toBe(true);
      expect(item.humanGateRequired).toBe(false);
      expect(item.confirmationRequired).toBe(false);
      expect(item.runtimeStatus).toBe("available");
    }
  });

  it("classifies draft write tools as draft_or_proposal, gated, non-autonomous", () => {
    const draftIds = ADMIN_WRITE_TOOL_IDS.filter(
      (id) => !REFLECTED_TOOL_META[id]!.externalEffect,
    );
    for (const id of draftIds) {
      const item = classifyReflectedTool({
        id,
        kind: "write",
        meta: REFLECTED_TOOL_META[id],
      });
      expect(item.tier).toBe("draft_or_proposal");
      expect(item.autonomousAllowed).toBe(false);
      expect(item.humanGateRequired).toBe(true);
      expect(item.confirmationRequired).toBe(true);
      expect(item.runtimeStatus).toBe("gated");
    }
  });

  it("classifies outreach_trigger_send_run as confirmed_write, gated, non-autonomous", () => {
    const item = classifyReflectedTool({
      id: "outreach_trigger_send_run",
      kind: "write",
      meta: REFLECTED_TOOL_META["outreach_trigger_send_run"],
    });
    expect(item.tier).toBe("confirmed_write");
    expect(item.autonomousAllowed).toBe(false);
    expect(item.humanGateRequired).toBe(true);
    expect(item.confirmationRequired).toBe(true);
  });

  it("an UNCLASSIFIED write-like tool fails safe (unknown, high risk, non-autonomous, gated)", () => {
    const item = classifyReflectedTool({
      id: "some_new_write_tool",
      kind: "write",
      meta: undefined,
    });
    expect(item.tier).toBe("unknown");
    expect(item.riskLevel).toBe("high");
    expect(item.autonomousAllowed).toBe(false);
    expect(item.humanGateRequired).toBe(true);
    expect(item.runtimeStatus).toBe("unknown");
  });

  it("forbidden-autonomous actions are never autonomous and not exposed", () => {
    for (const a of FORBIDDEN_AUTONOMOUS_ACTIONS) {
      expect(a.tier).toBe("forbidden_autonomous");
      expect(a.autonomousAllowed).toBe(false);
      expect(a.runtimeStatus).toBe("not_exposed");
    }
    // deploy / mark_live / governance_execute represented
    const ids = FORBIDDEN_AUTONOMOUS_ACTIONS.map((a) => a.id);
    expect(ids).toContain("mainnet_deploy");
    expect(ids).toContain("vault_mark_live");
    expect(ids).toContain("governance_execute");
  });
});

describe("counts", () => {
  it("counts every tier with the real registry shape", () => {
    const counts = countByTier(classifyAllTools());
    expect(counts.read_only).toBe(ADMIN_READ_TOOL_IDS.length); // 11
    expect(counts.draft_or_proposal + counts.confirmed_write).toBe(
      ADMIN_WRITE_TOOL_IDS.length,
    ); // 7
    expect(counts.confirmed_write).toBe(1);
    expect(counts.unknown).toBe(0);
    expect(counts.forbidden_autonomous).toBe(FORBIDDEN_AUTONOMOUS_ACTIONS.length);
  });
});

describe("consistency checks", () => {
  const reflected = classifyAllTools();

  it("clean reflection vs an in-sync static view → no critical issues", () => {
    const staticIds = reflected
      .filter((t) => t.tier !== "forbidden_autonomous")
      .map((t) => t.id);
    const issues = checkToolBoundaryConsistency(reflected, { toolIds: staticIds });
    expect(issues.filter((i) => i.severity === "critical")).toEqual([]);
  });

  it("flags a real tool missing from the static view (warning, missing-in-static)", () => {
    const staticIds = reflected
      .filter((t) => t.tier !== "forbidden_autonomous")
      .map((t) => t.id)
      .filter((id) => id !== "outreach_stats");
    const issues = checkToolBoundaryConsistency(reflected, { toolIds: staticIds });
    expect(
      issues.some(
        (i) => i.id === "missing-in-static:outreach_stats" && i.severity === "warning",
      ),
    ).toBe(true);
  });

  it("flags a stale static id not in the real registry (warning, stale-static)", () => {
    const staticIds = [
      ...reflected
        .filter((t) => t.tier !== "forbidden_autonomous")
        .map((t) => t.id),
      "ghost_tool_removed",
    ];
    const issues = checkToolBoundaryConsistency(reflected, { toolIds: staticIds });
    expect(
      issues.some(
        (i) => i.id === "stale-static:ghost_tool_removed" && i.severity === "warning",
      ),
    ).toBe(true);
  });

  it("flags an unknown tool (warning) and write-without-gate (critical)", () => {
    const withUnknown = [
      ...reflected,
      classifyReflectedTool({ id: "mystery_write", kind: "write", meta: undefined }),
      // a hand-crafted write tool with NO gate → critical
      {
        id: "ungated_write",
        name: "ungated_write",
        tier: "draft_or_proposal" as const,
        source: "x",
        autonomousAllowed: false,
        humanGateRequired: false,
        adminRequired: true,
        confirmationRequired: false,
        riskLevel: "high" as const,
        runtimeStatus: "gated" as const,
        notes: "",
      },
    ];
    const staticIds = withUnknown
      .filter((t) => t.tier !== "forbidden_autonomous")
      .map((t) => t.id);
    const issues = checkToolBoundaryConsistency(withUnknown, { toolIds: staticIds });
    expect(issues.some((i) => i.id === "unknown-tool:mystery_write")).toBe(true);
    expect(
      issues.some(
        (i) =>
          i.id === "write-without-gate:ungated_write" && i.severity === "critical",
      ),
    ).toBe(true);
  });

  it("flags a confirmed_write marked autonomous as critical", () => {
    const bad = [
      {
        id: "rogue_send",
        name: "rogue_send",
        tier: "confirmed_write" as const,
        source: "x",
        autonomousAllowed: true,
        humanGateRequired: true,
        adminRequired: true,
        confirmationRequired: true,
        riskLevel: "high" as const,
        runtimeStatus: "gated" as const,
        notes: "",
      },
    ];
    const issues = checkToolBoundaryConsistency(bad, { toolIds: ["rogue_send"] });
    expect(
      issues.some(
        (i) =>
          i.id === "confirmed-write-autonomous:rogue_send" &&
          i.severity === "critical",
      ),
    ).toBe(true);
  });
});

describe("buildToolBoundaryV1Summary", () => {
  it("builds a code_reflection summary with counts, tools, notes", () => {
    const staticIds = classifyAllTools()
      .filter((t) => t.tier !== "forbidden_autonomous")
      .map((t) => t.id);
    const summary = buildToolBoundaryV1Summary({ toolIds: staticIds });
    expect(summary.source).toBe("code_reflection");
    expect(summary.tools.length).toBe(
      ADMIN_READ_TOOL_IDS.length +
        ADMIN_WRITE_TOOL_IDS.length +
        FORBIDDEN_AUTONOMOUS_ACTIONS.length,
    );
    expect(summary.counts.read_only).toBe(ADMIN_READ_TOOL_IDS.length);
    expect(summary.safetyNotes.length).toBeGreaterThan(0);
    expect(summary.consistencyIssues.filter((i) => i.severity === "critical")).toEqual(
      [],
    );
    // generatedAt is a static marker, not a live timestamp
    expect(summary.generatedAt).toMatch(/static marker/i);
  });

  it("surfaces drift when the static view omits a real tool", () => {
    const summary = buildToolBoundaryV1Summary({ toolIds: ["read_market_snapshot"] });
    expect(
      summary.consistencyIssues.some((i) => i.id.startsWith("missing-in-static:")),
    ).toBe(true);
  });
});
