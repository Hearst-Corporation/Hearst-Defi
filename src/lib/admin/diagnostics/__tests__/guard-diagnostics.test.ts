import { beforeAll, describe, expect, it } from "vitest";

import { runGuardDiagnostics } from "@/lib/admin/diagnostics/guard-diagnostics";
import type { DiagnosticResult } from "@/lib/admin/diagnostics/types";

describe("guard diagnostics (real danger-first router + output guard)", () => {
  let results: DiagnosticResult[];
  beforeAll(async () => {
    results = await runGuardDiagnostics();
  });

  it("has zero failing checks", () => {
    const fails = results.filter((r) => r.status === "fail");
    expect(JSON.stringify(fails, null, 2)).toBe("[]");
  });

  it.each([
    "guard.forbidden-output-blocked",
    "guard.single-point-apy-blocked",
    "guard.apy-range-passes",
    "guard.negated-forbidden-no-fp",
    "guard.body-too-large-rejected",
  ])("%s passes against the real guard", (id) => {
    expect(results.find((r) => r.id === id)?.status).toBe("pass");
  });

  it.each([
    "guard.deploy-refused",
    "guard.sign-refused",
    "guard.governance-refused",
    "guard.migrate-formula-refused",
  ])(
    "%s is honestly SKIPPED — the danger-first router was removed",
    (id) => {
      const r = results.find((c) => c.id === id);
      expect(r?.status).toBe("skipped");
      expect(r?.actual).toMatch(/router removed|classifyAgenticIntent/i);
    },
  );
});
