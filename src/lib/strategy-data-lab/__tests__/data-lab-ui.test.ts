import { describe, it, expect } from "vitest";

/**
 * Source-level guards for the Strategy Data Lab UI — verify the modes are wired
 * and no guaranteed wording leaks into the labels (we can't mount recharts/chart
 * canvases headlessly, so we assert on the component source like the other
 * report-presentation guards).
 */
async function labSrc(): Promise<string> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  return fs.readFile(
    path.join(process.cwd(), "src/components/admin/strategies/data-lab/strategy-data-lab.tsx"),
    "utf8",
  );
}

describe("Strategy Data Lab UI", () => {
  it("wires all five modes (Backtest / Forward / Stress / Sensitivity / Trigger Analytics)", async () => {
    const src = await labSrc();
    expect(src).toContain("Backtest");
    expect(src).toContain("Forward Simulation");
    expect(src).toContain("Stress Matrix");
    expect(src).toContain("Sensitivity");
    expect(src).toContain("Trigger Analytics");
    // Bodies exist for each mode.
    expect(src).toContain("BacktestBody");
    expect(src).toContain("ForwardBody");
    expect(src).toContain("StressBody");
    expect(src).toContain("SensitivityBody");
  });

  it("runs the real deterministic engines (memoised, capped)", async () => {
    const src = await labSrc();
    expect(src).toContain("new BacktestRunner()");
    expect(src).toContain("new ForwardSimulationRunner()");
    expect(src).toContain("new StressMatrixRunner()");
    expect(src).toContain("new SensitivityAnalyzer()");
    expect(src).toContain("useMemo");
    // No client randomness.
    expect(src).not.toContain("Math.random");
  });

  it("labels outputs as conditional / modelled / not guaranteed", async () => {
    const src = await labSrc();
    expect(src.toLowerCase()).toContain("not guaranteed");
    expect(src.toLowerCase()).toContain("modelled");
    // No positive guarantee.
    for (const m of src.matchAll(/guaranteed/gi)) {
      const before = src.slice(Math.max(0, m.index - 5), m.index).toLowerCase();
      expect(before).toContain("not ");
    }
  });
});
