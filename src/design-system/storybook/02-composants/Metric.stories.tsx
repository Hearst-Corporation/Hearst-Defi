import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product primitive, imported as-is.
import { Metric } from "@/components/catalyst/metric";

const meta: Meta<typeof Metric> = {
  title: "02-composants/Metric",
  component: Metric,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Metric>;

// One story per variant, one per state — each number tile isolated.

export const Premium: Story = {
  args: { variant: "premium", label: "Capital deployed", value: "127,000.00 USDC", sublabel: "USDC subscribed" },
};

export const Plain: Story = {
  args: { variant: "plain", label: "Reported hashrate", value: "31,218 TH/s" },
};

export const Nested: Story = {
  args: { variant: "nested", label: "Monthly electricity cost", value: "16,408.00 USDC" },
};

export const WithProvenanceLive: Story = {
  args: { variant: "premium", label: "BTC earned", value: "0.01520000 BTC", provenance: "live" },
};

export const WithTrendUp: Story = {
  args: {
    variant: "premium",
    label: "Reserve runway",
    value: "14 months",
    trend: { direction: "up", text: "+2 vs last month" },
  },
};

export const WithTrendDown: Story = {
  args: {
    variant: "premium",
    label: "Coverage",
    value: "8 months",
    trend: { direction: "down", text: "-1 vs last month" },
  },
};
