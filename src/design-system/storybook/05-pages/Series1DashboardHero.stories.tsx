import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product composition, imported as-is. This is the exact
// component this session fixed for a real layout bug (eyebrow spacing +
// full-height KPI dividers, commit 1cc0cd30) — the story is what should have
// caught it before it shipped to a screenshot review.
import { Series1DashboardHero } from "@/components/series1-dashboard/Series1DashboardHero";

const meta: Meta<typeof Series1DashboardHero> = {
  title: "05-pages/Series1DashboardHero",
  component: Series1DashboardHero,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1DashboardHero>;

const BASE_CONTEXT = [
  { label: "Capital deployed", value: "127,000.00 USDC", hint: "USDC subscribed" },
  { label: "Term progress", value: "—", muted: true, hint: "Months elapsed" },
  { label: "Contract", value: "DynaVault v2.1", hint: "Preprod fork — not a record" },
  { label: "Reported hashrate", value: "31,218 TH/s", hint: "Last keeper report" },
  { label: "Mining state", value: "Not reported", muted: true, hint: "Current window" },
  { label: "Allocation mode", value: "Not reported", muted: true, hint: "40 / 27 / 33 policy" },
];

export const Live: Story = {
  args: {
    eyebrow: "Hearst Bitcoin Reserve Vault · Series 1",
    label: "Bitcoin accumulated",
    value: "0.01520000 BTC",
    caption:
      "Accumulated BTC is the principal investor outcome and is delivered at maturity. Market price is contextual only; it is not a return projection.",
    context: BASE_CONTEXT,
  },
};

export const Muted: Story = {
  args: {
    ...Live.args,
    muted: true,
  },
};
