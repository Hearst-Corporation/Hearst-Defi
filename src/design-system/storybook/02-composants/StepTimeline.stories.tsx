import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product primitive, imported as-is.
import { StepTimeline } from "@/components/catalyst/step-timeline";

const meta: Meta<typeof StepTimeline> = {
  title: "02-composants/StepTimeline",
  component: StepTimeline,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof StepTimeline>;

export const Default: Story = {
  args: {
    "aria-label": "How it works",
    steps: [
      { title: "USDC subscription", description: "deposit(assets, receiver) mints shares" },
      { title: "B1 / B2 / B3 allocation", description: "Assets route to the policy split on deposit" },
      { title: "BTC reserve ledger", description: "Mining production credits the reserve" },
      { title: "Delivery at maturity", description: "The accumulated reserve is delivered in BTC", tone: "accent" },
    ],
  },
};

export const WithMixedTones: Story = {
  args: {
    "aria-label": "Mixed tone example",
    steps: [
      { title: "Monitoring", description: "Continuous read of the collateral ratio", tone: "neutral" },
      { title: "Trigger armed", description: "Threshold breached — awaiting confirmation", tone: "warning" },
      { title: "Recovery executed", description: "Rebalance applied on-chain", tone: "accent" },
      { title: "Guardrail breach", description: "Manual intervention required", tone: "danger" },
    ],
  },
};
