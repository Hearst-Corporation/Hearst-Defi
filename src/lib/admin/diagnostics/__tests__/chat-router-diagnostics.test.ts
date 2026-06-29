import { describe, expect, it } from "vitest";

import { runChatRouterDiagnostics } from "@/lib/admin/diagnostics/chat-router-diagnostics";

describe("chat-router diagnostics (real deterministic router)", () => {
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
    "chat.deploy-refused",
    "chat.negated-deploy-cancellation",
    "chat.outreach-send-human-gate",
    "chat.lp-cannot-resolve-admin-nav",
    "chat.create-projection-not-product",
    "chat.bug-report-no-nav",
    "chat.unknown-no-write",
  ])("%s passes against the real router", (id) => {
    expect(results.find((r) => r.id === id)?.status).toBe("pass");
  });
});
