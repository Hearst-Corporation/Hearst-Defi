import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product composition, imported as-is.
import { Series1BitcoinAccumulation } from "@/components/series1-dashboard/Series1BitcoinAccumulation";

const meta: Meta<typeof Series1BitcoinAccumulation> = {
  title: "05-pages/Series1BitcoinAccumulation",
  component: Series1BitcoinAccumulation,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1BitcoinAccumulation>;

export const EmptySeries: Story = {
  args: { motive: null },
};

export const NotExposedByContract: Story = {
  args: { motive: "Not exposed by contract" },
};
