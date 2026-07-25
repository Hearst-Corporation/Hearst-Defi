import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real /portfolio hero band (Qatar-cockpit hairline-grid hero on
// Hearst tokens, green accent). Fixture-driven; covers a live headline and the
// honest dash state.
import { PositionHeroBand } from "@/app/(product)/portfolio/_charts/position-hero-band";

const meta: Meta<typeof PositionHeroBand> = {
  title: "05-pages/PositionHeroBand",
  component: PositionHeroBand,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof PositionHeroBand>;

export const Live: Story = {
  args: {
    eyebrow: "Hearst Bitcoin Reserve Vault · Series 1",
    headlineLabel: "Position value",
    headlineValue: "11 USDC",
    headlineHint: "PermissionedDynaVault v2.1 · read 05:22 UTC",
    metrics: [
      { label: "Share receipts", value: "11.00", hint: "Per-wallet share balance" },
      { label: "Subscription", value: "Eligible", hint: "Whitelist status" },
      { label: "Term", value: "24 months", hint: "BTC delivered at maturity" },
    ],
  },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent ?? "";
    await expect(text.includes("Position value")).toBe(true);
    await expect(text.includes("11 USDC")).toBe(true);
  },
};

export const NotReported: Story = {
  args: {
    eyebrow: "Hearst Bitcoin Reserve Vault · Series 1",
    headlineLabel: "Position value",
    headlineValue: "—",
    metrics: [
      { label: "Share receipts", value: "—", hint: "Per-wallet share balance" },
      { label: "Subscription", value: "—", hint: "Whitelist status" },
      { label: "Term", value: "—", hint: "BTC delivered at maturity" },
    ],
  },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent ?? "";
    await expect(text.includes("Position value")).toBe(true);
  },
};
