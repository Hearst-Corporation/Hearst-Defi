import { describe, expect, it } from "vitest";

import { runVaultHitlDiagnostics } from "@/lib/admin/diagnostics/vault-hitl-diagnostics";
import { ADMIN_WRITE_TOOL_IDS } from "@/lib/llm/tools/types";

describe("vault-hitl diagnostics (real tool-id registry)", () => {
  const noDeps = runVaultHitlDiagnostics();

  it("has zero failing checks", () => {
    const fails = noDeps.filter((r) => r.status === "fail");
    expect(JSON.stringify(fails, null, 2)).toBe("[]");
  });

  it.each([
    "vault.seven-write-tools",
    "vault.create-vault-draft-present",
    "vault.no-deploy-or-sign-tool",
    "vault.trigger-send-is-only-sender",
    "vault.read-capabilities-present",
    "vault.markaslive-not-chat",
  ])("%s passes against the real registry ids", (id) => {
    expect(noDeps.find((r) => r.id === id)?.status).toBe("pass");
  });

  it("SKIPS registry-introspection checks without injected deps", () => {
    expect(noDeps.find((r) => r.id === "vault.all-write-confirmation-required")?.status).toBe(
      "skipped",
    );
    expect(noDeps.find((r) => r.id === "vault.capabilities-deploy-no")?.status).toBe(
      "skipped",
    );
  });

  it("PASSES registry-introspection checks when the route injects real data", () => {
    const withDeps = runVaultHitlDiagnostics({
      writeTools: ADMIN_WRITE_TOOL_IDS.map((id) => ({
        id,
        confirmationRequired: true,
      })),
      capabilitiesLines: ["- deploy_execute_outille: no", "- db_write_outille: no"],
    });
    expect(
      withDeps.find((r) => r.id === "vault.all-write-confirmation-required")?.status,
    ).toBe("pass");
    expect(withDeps.find((r) => r.id === "vault.capabilities-deploy-no")?.status).toBe(
      "pass",
    );
  });
});
