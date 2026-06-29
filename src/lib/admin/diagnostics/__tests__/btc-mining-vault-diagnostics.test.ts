import { describe, expect, it } from "vitest";

import {
  runBtcMiningVaultDiagnostics,
  BTC_MINING_VAULT_DIAGNOSTIC_SUITE,
} from "@/lib/admin/diagnostics/btc-mining-vault-diagnostics";

function byId(id: string) {
  const r = runBtcMiningVaultDiagnostics().find((x) => x.id === id);
  if (!r) throw new Error(`diagnostic ${id} missing`);
  return r;
}

describe("runBtcMiningVaultDiagnostics", () => {
  it("returns the thirteen product checks, all in the suite", () => {
    const results = runBtcMiningVaultDiagnostics();
    expect(results.length).toBe(13);
    for (const r of results) {
      expect(r.suite).toBe(BTC_MINING_VAULT_DIAGNOSTIC_SUITE);
    }
    expect(results.map((r) => r.id).sort()).toEqual(
      [
        // baseline (8)
        "btc-sale-last-resort",
        "configured-not-validated",
        "coverage-gate-present",
        "mining-floor-enforced",
        "no-double-count",
        "no-guaranteed-language",
        "recovery-not-a-guarantee",
        "stable-reserve-not-first",
        // PROMPT 17 — Phase H (5)
        "waterfalls-present-and-ordered",
        "waterfall-no-guaranteed-distribution",
        "operator-economics-separate-from-apy",
        "monte-carlo-disclosure-honest",
        "calculated-vs-documented-present",
      ].sort(),
    );
  });

  it("is all-pass on the real product (no FAIL)", () => {
    const results = runBtcMiningVaultDiagnostics();
    const fails = results.filter((r) => r.status === "fail");
    expect(fails, JSON.stringify(fails, null, 2)).toHaveLength(0);
    expect(results.every((r) => r.status === "pass")).toBe(true);
  });

  it("every check is a dry-run with no side effect", () => {
    for (const r of runBtcMiningVaultDiagnostics()) {
      expect(r.sideEffect ?? "none").toBe("none");
    }
  });

  it("no-guaranteed-language check passes (clean copy)", () => {
    expect(byId("no-guaranteed-language").status).toBe("pass");
  });

  it("no-double-count check passes (inclusive, never summed)", () => {
    expect(byId("no-double-count").status).toBe("pass");
  });

  it("mining-floor check passes (sub-floor requires governance)", () => {
    const r = byId("mining-floor-enforced");
    expect(r.status).toBe("pass");
    expect(r.actual).toMatch(/governance exception/i);
  });

  it("configured-not-validated check passes", () => {
    expect(byId("configured-not-validated").status).toBe("pass");
  });

  it("coverage-gate check passes (PAUSE below 0.8, not paid below 1.0)", () => {
    const r = byId("coverage-gate-present");
    expect(r.status).toBe("pass");
    expect(r.actual).toMatch(/PAUSE_DISTRIBUTION/);
  });

  it("recovery-not-a-guarantee check passes", () => {
    const r = byId("recovery-not-a-guarantee");
    expect(r.status).toBe("pass");
    expect(r.actual).toMatch(/capital_only/);
  });

  it("btc-sale-last-resort check passes (no SELL on healthy input)", () => {
    const r = byId("btc-sale-last-resort");
    expect(r.status).toBe("pass");
    expect(r.actual).not.toMatch(/SELL_BTC_LAST_RESORT/);
  });

  it("stable-reserve-not-first check passes (borrow / idle, not reserve drain)", () => {
    const r = byId("stable-reserve-not-first");
    expect(r.status).toBe("pass");
    expect(r.actual).toMatch(/BORROW_AGAINST_BTC/);
    expect(r.actual).toMatch(/USE_IDLE_STABLE/);
  });

  it("is pure/deterministic across runs", () => {
    const a = runBtcMiningVaultDiagnostics().map((r) => ({
      id: r.id,
      status: r.status,
    }));
    const b = runBtcMiningVaultDiagnostics().map((r) => ({
      id: r.id,
      status: r.status,
    }));
    expect(a).toEqual(b);
  });
});
