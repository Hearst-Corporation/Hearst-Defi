import { describe, expect, it } from "vitest";

import { getReadUtilitySummary } from "@/components/admin/admin-chat-controls";

describe("admin chat controls export summary", () => {
  it("builds compact summary for export_demo_pack", () => {
    const summary = getReadUtilitySummary(
      JSON.stringify({
        requestedToolId: "export_demo_pack",
        executedToolId: "export_demo_pack",
        payload: {
          metadata: {
            generatedAt: "2026-06-13T00:00:00.000Z",
            objective: "Investor demo",
            audience: "IC",
          },
          demoPlan: [{}, {}, {}],
          charts: [{}, {}],
          checklist: ["a", "b"],
        },
      }),
    );

    expect(summary).not.toBeNull();
    expect(summary?.toolId).toBe("export_demo_pack");
    expect(summary?.generatedAt).toBe("2026-06-13T00:00:00.000Z");
    expect(summary?.counts).toEqual(
      expect.arrayContaining([
        { label: "demo Plan", value: 3 },
        { label: "charts", value: 2 },
        { label: "checklist", value: 2 },
      ]),
    );
  });

  it("returns null for non export tools", () => {
    const summary = getReadUtilitySummary(
      JSON.stringify({
        requestedToolId: "generate_demo_plan",
        executedToolId: "generate_demo_plan",
        payload: {
          steps: [{}, {}],
        },
      }),
    );
    expect(summary).toBeNull();
  });
});
