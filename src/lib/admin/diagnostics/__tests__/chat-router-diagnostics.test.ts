import { describe, expect, it } from "vitest";

import { runChatRouterDiagnostics } from "@/lib/admin/diagnostics/chat-router-diagnostics";

describe("chat-router diagnostics (real product-workspace classifier + nav resolver)", () => {
  const results = runChatRouterDiagnostics();

  it("has zero failing checks", () => {
    const fails = results.filter((r) => r.status === "fail");
    expect(JSON.stringify(fails, null, 2)).toBe("[]");
  });

  it("runs every check (no thrown checks)", () => {
    expect(results.length).toBe(10);
    expect(results.every((r) => r.suite === "chat-router")).toBe(true);
  });

  it.each([
    "chat.product-creation",
    "chat.create-projection-not-product",
    "chat.lp-cannot-resolve-admin-nav",
    "chat.lp-nav-allowed",
  ])("%s passes against the live functions", (id) => {
    expect(results.find((r) => r.id === id)?.status).toBe("pass");
  });

  it("chat.simulation-scenario-lab is honestly SKIPPED — the Scenario Lab route was retired", () => {
    const r = results.find((c) => c.id === "chat.simulation-scenario-lab");
    expect(r?.status).toBe("skipped");
    expect(r?.actual).toMatch(/scenario lab route retired/i);
  });

  it.each([
    "chat.deploy-refused",
    "chat.negated-deploy-cancellation",
    "chat.outreach-send-human-gate",
    "chat.unknown-no-write",
    "chat.bug-report-no-nav",
  ])(
    "%s is honestly SKIPPED — the agentic intent router was removed",
    (id) => {
      const r = results.find((c) => c.id === id);
      expect(r?.status).toBe("skipped");
      expect(r?.actual).toMatch(/router removed|classifyAgenticIntent/i);
    },
  );
});
