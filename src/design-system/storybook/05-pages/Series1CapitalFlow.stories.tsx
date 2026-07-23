import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product composition, imported as-is.
import { Series1CapitalFlow } from "@/components/series1-dashboard/Series1CapitalArchitecture";

const meta: Meta<typeof Series1CapitalFlow> = {
  title: "05-pages/Series1CapitalFlow",
  component: Series1CapitalFlow,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1CapitalFlow>;

export const Default: Story = {
  args: {},
};
