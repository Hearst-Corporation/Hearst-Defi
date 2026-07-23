import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product primitive, imported as-is.
import { Series1Timeline } from "@/components/series1-shell/Series1Timeline";

const meta: Meta<typeof Series1Timeline> = {
  title: "02-composants/Series1Timeline",
  component: Series1Timeline,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1Timeline>;

export const CapitalFlow: Story = {
  args: {
    steps: [
      { label: "USDC subscription", detail: "deposit(assets, receiver) mints shares", state: "done" },
      { label: "B1 / B2 / B3 allocation", detail: "Assets route to the policy split on deposit", state: "done" },
      { label: "BTC reserve ledger", detail: "Mining production credits the reserve", state: "current" },
      { label: "Delivery at maturity", detail: "The accumulated reserve is delivered in BTC", state: "upcoming" },
    ],
  },
};
