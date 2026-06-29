import { describe, expect, it } from "vitest";

import {
  buildCanvasModel,
  buildCanvasExport,
  computeCanvasMachineEcon,
  buildCanvasEconomics,
  buildCanvasScenario,
  DEFAULT_CANVAS_INPUTS,
  INPUT_PROVENANCE,
  type CanvasInputs,
} from "@/lib/products/mining-canvas-model";

const underwater: CanvasInputs = {
  ...DEFAULT_CANVAS_INPUTS,
  hashpriceUsdPerThDay: 0.01, // below energy+capex → mining underwater
  stableYieldPct: 9,
};

describe("canvas machine economics", () => {
  it("net = gross − total cost; profitable flag tracks the sign", () => {
    const m = computeCanvasMachineEcon(DEFAULT_CANVAS_INPUTS);
    expect(m.netUsdPerThDay).toBeCloseTo(
      m.grossRevenueUsdPerThDay - m.totalCostUsdPerThDay,
      5,
    );
    expect(m.miningProfitable).toBe(m.netUsdPerThDay > 0);
  });

  it("raw mining economics CAN be negative (underwater hashprice)", () => {
    const m = computeCanvasMachineEcon(underwater);
    expect(m.netUsdPerThDay).toBeLessThan(0);
    expect(m.lpMiningYieldPct).toBeLessThan(0);
    const econ = buildCanvasEconomics(underwater, m);
    expect(econ.raw.blendedApyPct).toBeLessThan(0);
  });
});

describe("allocator-adjusted economics", () => {
  it("underwater mining → allocator reduces exposure to the floor + flags governance", () => {
    const m = buildCanvasModel(underwater);
    const balanced = m.scenarios.find((s) => s.regime === "balanced")!;
    expect(balanced.allocation.mining).toBe(30); // clamped to floor
    expect(balanced.governanceException).toBe(true);
    expect(balanced.miningProfitable).toBe(false);
  });

  it("negative adjusted APY despite positive stable → bug candidate (never hidden)", () => {
    const m = computeCanvasMachineEcon(underwater);
    const econ = buildCanvasEconomics(underwater, m);
    expect(econ.adjusted.blendedApyPct).toBeLessThan(0);
    expect(econ.bugCandidate).toBe(true);
    expect(econ.negativeDrivers.some((d) => d.includes("BUG CANDIDATE"))).toBe(true);
    // rotation still helps: adjusted ≥ raw forced blend
    expect(econ.adjusted.blendedApyPct).toBeGreaterThanOrEqual(
      econ.raw.blendedApyPct,
    );
  });

  it("healthy mining is NOT a bug candidate", () => {
    const m = computeCanvasMachineEcon(DEFAULT_CANVAS_INPUTS);
    const econ = buildCanvasEconomics(DEFAULT_CANVAS_INPUTS, m);
    expect(econ.bugCandidate).toBe(false);
  });
});

describe("scenarios", () => {
  it("outputs include Defensive / Balanced / Opportunistic in order", () => {
    const m = buildCanvasModel();
    expect(m.scenarios.map((s) => s.regime)).toEqual([
      "defensive",
      "balanced",
      "opportunistic",
    ]);
  });

  it("every scenario keeps mining ≥ 30% (normal-mode floor)", () => {
    for (const inputs of [DEFAULT_CANVAS_INPUTS, underwater]) {
      const m = buildCanvasModel(inputs);
      for (const s of m.scenarios) {
        expect(s.allocation.mining).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("each scenario carries an APY range, p5/p50/p95 and a coverage state", () => {
    const s = buildCanvasScenario("balanced", DEFAULT_CANVAS_INPUTS, 20);
    expect(s.apyLowPct).toBeLessThanOrEqual(s.apyHighPct);
    expect(s.p5).toBeLessThanOrEqual(s.p50);
    expect(s.p50).toBeLessThanOrEqual(s.p95);
    expect(["healthy", "adequate", "stressed", "suspended"]).toContain(
      s.coverageState,
    );
  });
});

describe("construction steps", () => {
  it("include a formula + inputs + output for every step", () => {
    const m = buildCanvasModel();
    expect(m.steps.length).toBeGreaterThanOrEqual(12);
    for (const step of m.steps) {
      expect(step.formula.length).toBeGreaterThan(0);
      expect(step.output.length).toBeGreaterThan(0);
      expect(Object.keys(step.inputs).length).toBeGreaterThan(0);
    }
  });
});

describe("export + status model", () => {
  it("export JSON includes inputs / outputs / scenarios / warnings", () => {
    const e = buildCanvasExport();
    expect(e.inputs).toBeDefined();
    expect(e.outputs).toBeDefined();
    expect(e.scenarios).toHaveLength(3);
    expect(Array.isArray(e.warnings)).toBe(true);
    expect(typeof e.economics.adjustedApyPct).toBe("number");
  });

  it("CONFIGURED is never presented as VALIDATED", () => {
    const provs = Object.values(INPUT_PROVENANCE);
    expect(provs).not.toContain("VALIDATED");
    expect(provs).not.toContain("CONTRACTUAL");
  });

  it("deterministic: same inputs → identical model", () => {
    expect(buildCanvasExport()).toEqual(buildCanvasExport());
  });
});
