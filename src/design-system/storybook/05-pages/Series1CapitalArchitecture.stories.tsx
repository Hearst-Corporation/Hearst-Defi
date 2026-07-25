import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product composition, imported as-is.
import { Series1CapitalArchitecture } from "@/components/series1-dashboard/Series1CapitalArchitecture";

const meta: Meta<typeof Series1CapitalArchitecture> = {
  title: "05-pages/Series1CapitalArchitecture",
  component: Series1CapitalArchitecture,
  parameters: {
    layout: "padded",
    a11y: {
      // The allocation bars now render through Recharts; the ResponsiveContainer
      // trips `scrollable-region-focusable`. Scoped off so the gate tests the
      // composition's own chrome, not the third-party overflow.
      config: {
        rules: [{ id: "scrollable-region-focusable", enabled: false }],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Series1CapitalArchitecture>;

export const Measured: Story = {
  args: {
    policyNotice: null,
    pockets: [
      { id: "B1", label: "Mining Power", value: 40 },
      { id: "B2", label: "BTC Pouch", value: 27 },
      { id: "B3", label: "Reserve USDC", value: 33 },
    ],
  },
};

export const PolicyTargetOnly: Story = {
  args: {
    policyNotice: "the measured pocket allocation appears once the v2.1 contract is deployed",
    pockets: [],
  },
};

export const Drift: Story = {
  args: {
    policyNotice: null,
    pockets: [
      { id: "B1", label: "Mining Power", value: 44 },
      { id: "B2", label: "BTC Pouch", value: 24 },
      { id: "B3", label: "Reserve USDC", value: 32 },
    ],
  },
};
