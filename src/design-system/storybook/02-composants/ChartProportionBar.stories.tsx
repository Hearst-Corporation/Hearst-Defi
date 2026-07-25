import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the canonical Recharts proportion bar, imported as-is. This is the
// HC-CHART-001 replacement for the retired HIS `HcStackedBar` — a 100%-stacked
// horizontal track whose consumers (Series1CapitalArchitecture, the allocation
// cockpit) now render THIS.
import { ChartProportionBar } from "@/components/catalyst/chart-proportion-bar";

const meta: Meta<typeof ChartProportionBar> = {
  title: "02-composants/ChartProportionBar",
  component: ChartProportionBar,
  parameters: {
    layout: "padded",
    a11y: {
      // `scrollable-region-focusable` fires on the Recharts ResponsiveContainer
      // this primitive wraps — a known Recharts overflow, not a defect in the
      // bar's own chrome. Scoped off so the gate tests what the bar owns.
      config: {
        rules: [{ id: "scrollable-region-focusable", enabled: false }],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChartProportionBar>;

const POCKETS = [
  { label: "B1 · Mining Power", value: 40 },
  { label: "B2 · BTC Pouch", value: 27 },
  { label: "B3 · Reserve USDC", value: 33 },
];

// One story per palette, one per legend state — each bar isolated.

export const Categorical: Story = {
  args: {
    segments: POCKETS,
    palette: "categorical",
    height: 12,
    showLegend: false,
    "aria-label": "Policy target: allocation across the three Series 1 pockets",
  },
  play: async ({ canvasElement }) => {
    // With data, the bar wraps a Recharts BarChart in a role=img container and
    // is not the honest-empty track.
    const bar = canvasElement.querySelector('[role="img"]');
    await expect(bar).not.toBeNull();
    await expect(bar?.getAttribute("data-chart-empty")).toBeNull();
    // Each segment renders one Recharts bar rectangle — three pockets, three rects.
    await expect(
      canvasElement.querySelectorAll(".recharts-rectangle").length,
    ).toBe(3);
  },
};

export const CategoricalWithLegend: Story = {
  args: {
    segments: POCKETS,
    palette: "categorical",
    height: 12,
    showLegend: true,
    "aria-label": "Policy target: allocation across the three Series 1 pockets",
  },
  play: async ({ canvasElement, canvas }) => {
    // The optional legend lists one <li> per segment with its label + share.
    await expect(canvasElement.querySelectorAll("ul li").length).toBe(3);
    await expect(canvas.getByText("B1 · Mining Power")).toBeVisible();
    await expect(canvas.getByText("B2 · BTC Pouch")).toBeVisible();
    await expect(canvas.getByText("B3 · Reserve USDC")).toBeVisible();
  },
};

export const AccentRamp: Story = {
  args: {
    segments: POCKETS,
    palette: "accent",
    height: 12,
    showLegend: true,
    "aria-label": "Single-family accent ramp variant",
  },
};

/**
 * Honest empty: an all-zero input renders the neutral track only — a
 * role=img div flagged data-chart-empty, never a fabricated fill or a Recharts
 * bar rectangle.
 */
export const ZeroTotalHonestEmpty: Story = {
  args: {
    segments: [
      { label: "B1 · Mining Power", value: 0 },
      { label: "B2 · BTC Pouch", value: 0 },
      { label: "B3 · Reserve USDC", value: 0 },
    ],
    palette: "categorical",
    height: 12,
    showLegend: false,
    "aria-label": "Empty allocation — no measured split",
  },
  play: async ({ canvasElement }) => {
    // The empty state is an honest neutral track, tagged data-chart-empty…
    const empty = canvasElement.querySelector('[data-chart-empty="true"]');
    await expect(empty).not.toBeNull();
    await expect(empty?.getAttribute("role")).toBe("img");
    // …and it draws NO Recharts bar rectangle (no fabricated fill).
    await expect(
      canvasElement.querySelectorAll(".recharts-rectangle").length,
    ).toBe(0);
  },
};
