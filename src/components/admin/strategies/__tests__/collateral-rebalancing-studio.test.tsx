import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CollateralRebalancingStudio } from "@/components/admin/strategies/collateral-rebalancing-studio";
import {
  applyCollateralPathPreset,
  buildCollateralStudioInitialInput,
} from "@/components/admin/strategies/collateral-rebalancing-studio.helpers";
import {
  summarizeCollateralOptimization,
  toCollateralStudioViewModel,
  validateCollateralInput,
} from "@/lib/strategy-data-lab";
import {
  LAB_BASE_COLLATERAL,
  LAB_BASE_RULES,
} from "@/lib/strategy-data-lab/lab-defaults";

function renderStudio(): string {
  return renderToStaticMarkup(
    <CollateralRebalancingStudio
      strategyName="USDC-funded Collateral Rebalancing"
      statusLabel="Draft"
      collateral={LAB_BASE_COLLATERAL}
      rules={LAB_BASE_RULES}
    />,
  );
}

describe("CollateralRebalancingStudio", () => {
  it("renders the collateral studio contract with exactly three buckets", () => {
    const html = renderStudio();

    expect(html).toContain("Collateral Rebalancing Studio");
    expect(html).toContain("Top Decision Summary");
    expect(html).toContain("Invested USDC");
    expect(html).toContain("Borrowed working liquidity");
    expect(html).toContain("workingReserveUsdc = reserveAllocatedUsdc + debtUsdc");
    expect(html).toContain("Mining");
    expect(html).toContain("BTC / wBTC RC20");
    expect(html).toContain(">USDC<");
    expect(html).not.toContain("Yield bucket");
    expect(html).not.toContain("yieldOverlay");
    expect(html).not.toContain("recommended");
    expect(html).not.toContain("defensive");
    expect(html).not.toContain("aggressive");
  });

  it("keeps advanced sections collapsed by default", () => {
    const html = renderStudio();

    expect(html).toContain("Advanced controls");
    expect(html).toContain("Advanced month-by-month timeline");
    expect(html).toContain("Advanced Details");
    expect(html).not.toContain("<details open=\"\"");
  });
});

describe("collateral studio UI glue", () => {
  it("recalculates the summary when investment changes", () => {
    const { input, preset } = buildCollateralStudioInitialInput(
      LAB_BASE_COLLATERAL,
      LAB_BASE_RULES,
    );

    const baseSummary = summarizeCollateralOptimization(input);
    const doubled = applyCollateralPathPreset(
      { ...input, investmentUsdc: input.investmentUsdc * 2 },
      preset,
    );
    const doubledSummary = summarizeCollateralOptimization(doubled);

    expect(doubledSummary.base.investmentUsdc).toBe(baseSummary.base.investmentUsdc * 2);
    expect(doubledSummary.base.miningAllocatedUsdc).toBe(baseSummary.base.miningAllocatedUsdc * 2);
    expect(doubledSummary.base.workingReserveUsdc).toBeGreaterThan(baseSummary.base.workingReserveUsdc);
  });

  it("updates bucket values when allocations change and stays at exactly three buckets", () => {
    const { input, preset } = buildCollateralStudioInitialInput(
      LAB_BASE_COLLATERAL,
      LAB_BASE_RULES,
    );

    const tilted = applyCollateralPathPreset(
      {
        ...input,
        miningAllocationPct: 0.35,
        btcAllocationPct: 0.5,
        usdcAllocationPct: 0.15,
      },
      preset,
    );

    const summary = summarizeCollateralOptimization(tilted);
    const viewModel = toCollateralStudioViewModel(summary);

    expect(viewModel.bucketCards).toHaveLength(3);
    expect(summary.base.miningAllocatedUsdc).toBe(350_000);
    expect(summary.base.btcAllocatedUsdc).toBe(500_000);
    expect(summary.base.reserveAllocatedUsdc).toBe(150_000);
  });

  it("shows validation warnings when allocations do not sum to 100%", () => {
    const { input, preset } = buildCollateralStudioInitialInput(
      LAB_BASE_COLLATERAL,
      LAB_BASE_RULES,
    );

    const invalid = applyCollateralPathPreset(
      {
        ...input,
        miningAllocationPct: 0.4,
        btcAllocationPct: 0.4,
        usdcAllocationPct: 0.4,
      },
      preset,
    );

    const validation = validateCollateralInput(invalid);

    expect(validation.isValid).toBe(false);
    expect(
      validation.errors.some((issue) =>
        issue.message.toLowerCase().includes("100%"),
      ),
    ).toBe(true);
  });
});
