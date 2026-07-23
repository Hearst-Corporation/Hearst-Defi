import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product composition, imported as-is.
import { Series1MiningRegister } from "@/components/series1-dashboard/Series1MiningRegister";

const meta: Meta<typeof Series1MiningRegister> = {
  title: "05-pages/Series1MiningRegister",
  component: Series1MiningRegister,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1MiningRegister>;

export const MiningReport: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    rows: [
      { label: "BTC earned", value: "0.01520000 BTC", hint: "Cumulative, delivered at maturity" },
      { label: "Last report", value: "2026-07-22" },
      { label: "Allocation split", value: "40.00% · 27.00% · 33.00%", hint: "Measured on-chain" },
    ],
  },
};

export const ReserveAndContract: Story = {
  args: {
    title: "Reserve and contract",
    caption: "B3 Operating Reserve funds electricity; the contract state is read directly.",
    motive: null,
    rows: [
      { label: "Monthly electricity cost", value: "16,408.00 USDC" },
      { label: "Total paid since inception", value: "0.00 USDC" },
      { label: "Last payment", value: "Never paid" },
      { label: "Underlying asset", value: "USDC…USDC", hint: "Read from the contract" },
      { label: "Delivery evidence", value: "At maturity", hint: "Contractual term, not a chain read" },
    ],
  },
};

export const Unresolved: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: "Not exposed by contract",
    rows: [
      { label: "BTC earned", value: "Not reported", muted: true },
      { label: "Last report", value: "Not reported", muted: true },
      { label: "Allocation split", value: "40% · 27% · 33%", hint: "Configured policy target", muted: true },
    ],
  },
};
