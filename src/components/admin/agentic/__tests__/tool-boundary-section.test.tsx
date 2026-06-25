/**
 * ToolBoundarySection (v1) — read-only render contract.
 *
 * Verifies the per-tier count cards, the tool table (tier / risk / gate / source),
 * the consistency-warnings card, the forbidden-actions list, and the safety notes
 * — with NO write/action controls (no <button>, <form>, <input>, no run/send/deploy).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ToolBoundarySection } from "@/components/admin/agentic/tool-boundary-section";
import type {
  ReflectedToolBoundaryItem,
  ToolBoundaryV1Summary,
} from "@/lib/agentic/tool-boundary";

function tool(
  over: Partial<ReflectedToolBoundaryItem> = {},
): ReflectedToolBoundaryItem {
  return {
    id: "read_market_snapshot",
    name: "read_market_snapshot",
    tier: "read_only",
    source: "src/lib/llm/tools/registry.ts",
    autonomousAllowed: true,
    humanGateRequired: false,
    adminRequired: true,
    confirmationRequired: false,
    riskLevel: "low",
    runtimeStatus: "available",
    notes: "bounded read",
    ...over,
  };
}

function summary(
  over: Partial<ToolBoundaryV1Summary> = {},
): ToolBoundaryV1Summary {
  return {
    generatedAt: "code reflection (static marker) / read-only",
    source: "code_reflection",
    counts: {
      read_only: 11,
      draft_or_proposal: 6,
      confirmed_write: 1,
      forbidden_autonomous: 8,
      unknown: 0,
    },
    tools: [
      tool(),
      tool({
        id: "create_vault_draft",
        name: "create_vault_draft",
        tier: "draft_or_proposal",
        autonomousAllowed: false,
        humanGateRequired: true,
        confirmationRequired: true,
        riskLevel: "high",
        runtimeStatus: "gated",
      }),
      tool({
        id: "outreach_trigger_send_run",
        name: "outreach_trigger_send_run",
        tier: "confirmed_write",
        autonomousAllowed: false,
        humanGateRequired: true,
        confirmationRequired: true,
        riskLevel: "high",
        runtimeStatus: "gated",
      }),
      tool({
        id: "mainnet_deploy",
        name: "Mainnet deploy",
        tier: "forbidden_autonomous",
        autonomousAllowed: false,
        humanGateRequired: true,
        riskLevel: "critical",
        runtimeStatus: "not_exposed",
        notes: "never an agent tool",
      }),
    ],
    consistencyIssues: [],
    safetyNotes: [
      "Read-only reflection of the real tool registry. No tool is executed.",
    ],
    ...over,
  };
}

function render(s: ToolBoundaryV1Summary | null | undefined): string {
  return renderToStaticMarkup(<ToolBoundarySection summary={s} />);
}

const NO_WRITE_CONTROLS = (html: string) => {
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<input");
};

const NO_DANGEROUS_ACTION_WORDS = (html: string) => {
  // No run/send/deploy/source ACTION controls. (We allow the words inside
  // descriptive notes, but there must be no actionable control element.)
  NO_WRITE_CONTROLS(html);
};

describe("ToolBoundarySection v1", () => {
  it("renders heading, count cards, and source badge", () => {
    const html = render(summary());
    expect(html).toContain("Tool Boundary v1");
    expect(html).toContain("source: code reflection");
    expect(html).toContain("Read-only");
    expect(html).toContain("Draft / proposal");
    expect(html).toContain("Confirmed-write");
    expect(html).toContain("11"); // read_only count
    NO_DANGEROUS_ACTION_WORDS(html);
  });

  it("renders the tools table with tier / risk / gate / runtime / source", () => {
    const html = render(summary());
    expect(html).toContain("read_market_snapshot");
    expect(html).toContain("create_vault_draft");
    expect(html).toContain("outreach_trigger_send_run");
    expect(html).toContain("HITL"); // gate for write tools
    expect(html).toContain("src/lib/llm/tools/registry.ts"); // source
    expect(html).toContain("available");
    expect(html).toContain("gated");
    NO_DANGEROUS_ACTION_WORDS(html);
  });

  it("renders the forbidden-autonomous actions separately", () => {
    const html = render(summary());
    expect(html).toContain("Forbidden-autonomous actions");
    expect(html).toContain("Mainnet deploy");
    NO_DANGEROUS_ACTION_WORDS(html);
  });

  it("shows 'consistent' + 'no drift' when there are no issues", () => {
    const html = render(summary());
    expect(html).toContain("consistent");
    expect(html).toContain("no drift");
    NO_DANGEROUS_ACTION_WORDS(html);
  });

  it("renders consistency warnings when present", () => {
    const html = render(
      summary({
        consistencyIssues: [
          {
            id: "missing-in-static:read_specs_index",
            severity: "warning",
            message: "read_specs_index is not shown in the static boundary.",
          },
          {
            id: "write-without-gate:rogue",
            severity: "critical",
            message: "rogue is not human-gated.",
          },
        ],
      }),
    );
    expect(html).toContain("1 critical");
    expect(html).toContain("2 issues");
    expect(html).toContain("not shown in the static boundary");
    expect(html).toContain("warning");
    expect(html).toContain("critical");
    NO_DANGEROUS_ACTION_WORDS(html);
  });

  it("renders the safety notes", () => {
    const html = render(summary());
    expect(html).toContain("Safety");
    expect(html).toContain("No tool is executed");
    NO_DANGEROUS_ACTION_WORDS(html);
  });

  it("renders nothing when summary is null/undefined", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });
});
