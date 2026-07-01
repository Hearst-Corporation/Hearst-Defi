import { describe, it, expect } from "vitest";

/**
 * Source-level guards for the Strategy Data Lab UI — verify the modes are wired,
 * progressive disclosure is in place, sub-tabs exist, and no guaranteed wording
 * leaks into the labels (we can't mount recharts/chart canvases headlessly, so
 * we assert on the component source like the other report-presentation guards).
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
    expect(src).toContain("SensitivityPanel");
    expect(src).toContain("TriggerAnalyticsPanel");
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

  it("implements progressive disclosure — Lab starts collapsed", async () => {
    const src = await labSrc();
    // useState(false) for labOpen — lab starts collapsed
    expect(src).toContain("labOpen");
    expect(src).toContain("setLabOpen");
    // Collapsed card renders before opening
    expect(src).toContain("LabCollapsedCard");
    expect(src).toContain("Open Data Lab");
    // Collapse affordance when open
    expect(src).toContain("Collapse");
  });

  it("has sub-tab bar with Return / Risk / Attribution / Drawdown views", async () => {
    const src = await labSrc();
    // Sub-tab label strings
    expect(src).toContain('"Return"');
    expect(src).toContain('"Risk"');
    expect(src).toContain('"Attribution"');
    expect(src).toContain('"Drawdown"');
    // SubTabBar component
    expect(src).toContain("SubTabBar");
    // View state
    expect(src).toContain("view === \"return\"");
    expect(src).toContain("view === \"risk\"");
    expect(src).toContain("view === \"attribution\"");
    expect(src).toContain("view === \"drawdown\"");
  });

  it("has an Advanced metrics collapsible for the backtest table", async () => {
    const src = await labSrc();
    // details/summary HTML element for collapsible
    expect(src).toContain("<details");
    expect(src).toContain("<summary");
    // Advanced label
    expect(src.toLowerCase()).toContain("advanced");
  });

  it("compact backtest table has 5 headline columns not 11", async () => {
    const src = await labSrc();
    // Compact column headers present
    expect(src).toContain("Best scenario");
    expect(src).toContain("Final ROI range");
    expect(src).toContain("Liq. risk");
    // Advanced (full) table still exists inside the collapsible
    expect(src).toContain("Ann. ROI");
    expect(src).toContain("Sharpe~");
  });

  it("has trimmed KPI strip (4 items) not 7", async () => {
    const src = await labSrc();
    // The 4 retained KPIs
    expect(src).toContain("Avg final ROI");
    expect(src).toContain("Best ROI");
    expect(src).toContain("Worst ROI");
    expect(src).toContain("Liquidation freq.");
    // The removed KPIs should NOT appear as KPI strip items in BacktestBody
    // (they are dropped from the strip — "Best scenario" and "Repurchase freq." as KPI items)
    // Note: "Best scenario" still appears as a table column header — that's fine.
    // "Repurchase freq." should be gone entirely from BacktestBody KPI strip.
    const backtestBodyStart = src.indexOf("function BacktestBody");
    const backtestBodyEnd = src.indexOf("function ForwardBody");
    const backtestSection = src.slice(backtestBodyStart, backtestBodyEnd);
    expect(backtestSection).not.toContain('"Repurchase freq."');
  });
});
