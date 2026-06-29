import { describe, expect, it } from "vitest";

import {
  DIAGNOSTIC_SUITES,
  runAllSuites,
  runSuite,
} from "@/lib/admin/diagnostics/run-diagnostic-suite";

describe("diagnostic suite orchestrator", () => {
  it("wraps a suite in the safe dry-run envelope", async () => {
    const r = await runSuite("chat-router");
    expect(r.mode).toBe("dry-run");
    expect(r.runtimeTouched).toBe(true);
    expect(r.externalSideEffects).toBe(false);
    expect(r.dbWrites).toBe("none");
    expect(r.summary.total).toBeGreaterThan(0);
    expect(r.ok).toBe(r.summary.fail === 0);
  });

  it("runs all suites with zero failing checks", async () => {
    const all = await runAllSuites();
    expect(all.map((s) => s.suite).sort()).toEqual([...DIAGNOSTIC_SUITES].sort());
    for (const s of all) {
      const fails = s.results.filter((r) => r.status === "fail");
      expect(`${s.suite}: ${JSON.stringify(fails)}`).toBe(`${s.suite}: []`);
      expect(s.externalSideEffects).toBe(false);
    }
  });
});
