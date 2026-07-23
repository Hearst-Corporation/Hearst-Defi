import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product primitive, imported as-is.
import { Series1ChartPlaceholder } from "@/components/series1-shell/Series1ChartPlaceholder";

const meta: Meta<typeof Series1ChartPlaceholder> = {
  title: "02-composants/Series1ChartPlaceholder",
  component: Series1ChartPlaceholder,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1ChartPlaceholder>;

export const Live: Story = {
  args: {
    title: "Reserve trajectory",
    status: "live",
    label: "No accumulation series yet",
    detail:
      "The contract reports a cumulative total, not a per-month series. The curve appears once the ledger indexes monthly credits.",
  },
};

export const Unavailable: Story = {
  args: {
    title: "Reserve trajectory",
    status: "unavailable",
    label: "Indexer unreachable",
    detail: "This is an outage of the read, not a statement that no record exists.",
  },
};

export const Configured: Story = {
  args: {
    title: "Reserve trajectory",
    status: "configured",
    label: "Awaiting v2.1 deployment",
    detail: "Figures resolve once the contract is deployed and reporting.",
  },
};
