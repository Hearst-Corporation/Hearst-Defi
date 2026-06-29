import { describe, expect, it } from "vitest";

import {
  runBtcMiningConstructionScenarioDiagnostics,
  BTC_MINING_CONSTRUCTION_SCENARIO_SUITE,
} from "@/lib/admin/diagnostics/btc-mining-construction-scenario-diagnostics";

describe("BTC mining construction scenario diagnostics", () => {
  const results = runBtcMiningConstructionScenarioDiagnostics();

  it("all checks belong to the suite", () => {
    expect(results.length).toBeGreaterThanOrEqual(9);
    for (const r of results) {
      expect(r.suite).toBe(BTC_MINING_CONSTRUCTION_SCENARIO_SUITE);
    }
  });

  it("no check fails (warn/info allowed for the documented chat-tool gap)", () => {
    const failed = results.filter((r) => r.status === "fail");
    expect(
      failed,
      `failed: ${failed.map((f) => `${f.id} — ${f.actual}`).join(" | ")}`,
    ).toHaveLength(0);
  });

  it("documents the chat-tool scenario gap as a non-failing warning", () => {
    const gap = results.find((r) => r.id === "chat-tool-scenario-gap");
    expect(gap).toBeDefined();
    expect(gap!.status).toBe("warn");
  });

  it("asserts the core invariants (floor, negative-apy handling, configured-not-validated)", () => {
    const ids = new Set(results.map((r) => r.id));
    for (const id of [
      "scenarios-present",
      "mining-floor-respected",
      "adjusted-not-silently-negative",
      "coverage-gate-classified",
      "configured-never-validated",
      "read-only-no-effects",
    ]) {
      expect(ids.has(id), `missing: ${id}`).toBe(true);
    }
  });
});
