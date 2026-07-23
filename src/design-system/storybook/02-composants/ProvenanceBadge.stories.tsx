import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product primitive, imported as-is.
import { ProvenanceBadge } from "@/components/catalyst/provenance-badge";

const meta: Meta<typeof ProvenanceBadge> = {
  title: "02-composants/ProvenanceBadge",
  component: ProvenanceBadge,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof ProvenanceBadge>;

// One story per provenance kind — each badge isolated.

export const Live: Story = { args: { kind: "live" } };
export const Oracle: Story = { args: { kind: "oracle" } };
export const Attested: Story = { args: { kind: "attested" } };
export const Estimated: Story = { args: { kind: "estimated" } };
export const Partial: Story = { args: { kind: "partial" } };
export const Manual: Story = { args: { kind: "manual" } };
export const Stale: Story = { args: { kind: "stale" } };
export const Simulated: Story = { args: { kind: "simulated" } };
