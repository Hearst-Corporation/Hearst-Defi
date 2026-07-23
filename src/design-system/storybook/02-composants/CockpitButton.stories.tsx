import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product primitive, imported as-is.
import { CockpitButton } from "@/components/catalyst/cockpit-button";

const meta: Meta<typeof CockpitButton> = {
  title: "02-composants/CockpitButton",
  component: CockpitButton,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof CockpitButton>;

// One story per variant — each button isolated, no combined grid.

export const Primary: Story = {
  args: { variant: "primary", children: "Primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Secondary" },
};

export const Quiet: Story = {
  args: { variant: "quiet", children: "Quiet" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Outline" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Ghost" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Danger" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Destructive" },
};

// One story per size — variant held at primary so only size changes.

export const SizeSmall: Story = {
  args: { variant: "primary", size: "sm", children: "Small" },
};

export const SizeMedium: Story = {
  args: { variant: "primary", size: "md", children: "Medium" },
};

export const SizeLarge: Story = {
  args: { variant: "primary", size: "lg", children: "Large" },
};

export const SizeIcon: Story = {
  args: { variant: "primary", size: "icon", children: "→" },
};

// One story per shape.

export const ShapePill: Story = {
  args: { variant: "secondary", shape: "pill", children: "Pill" },
};

export const ShapeRect: Story = {
  args: { variant: "secondary", shape: "rect", children: "Rect" },
};

// State.

export const Disabled: Story = {
  args: { variant: "primary", disabled: true, children: "Disabled" },
};
