import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product chart primitive, imported as-is.
import { HcStackedBar } from "@/components/dataviz/his";

const meta: Meta<typeof HcStackedBar> = {
  title: "02-composants/HcStackedBar",
  component: HcStackedBar,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof HcStackedBar>;

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
};

export const CategoricalWithLegend: Story = {
  args: {
    segments: POCKETS,
    palette: "categorical",
    height: 12,
    showLegend: true,
    "aria-label": "Policy target: allocation across the three Series 1 pockets",
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
