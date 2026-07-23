import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real dashboard instrument, imported as-is.
import { Series1AllocationCockpit } from "@/components/series1-dashboard/Series1AllocationCockpit";
import type { Series1Pocket } from "@/components/series1-dashboard/Series1CapitalArchitecture";

const TARGET: Series1Pocket[] = [
  { id: "B1", label: "Mining Power", value: 40 },
  { id: "B2", label: "BTC Reserve", value: 27 },
  { id: "B3", label: "Operating Reserve", value: 33 },
];

const ACTUAL: Series1Pocket[] = [
  { id: "B1", label: "Mining Power", value: 42 },
  { id: "B2", label: "BTC Reserve", value: 25 },
  { id: "B3", label: "Operating Reserve", value: 33 },
];

const meta: Meta<typeof Series1AllocationCockpit> = {
  title: "05-pages/Series1AllocationCockpit",
  component: Series1AllocationCockpit,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1AllocationCockpit>;

// Series 1 forbids yield/APY/coupon/distribution and any fake BTC curve.
const FORBIDDEN = ["yield", "Yield", "APY", "coupon", "Coupon", "distribution", "Distribution"];

async function assertContract(canvasElement: HTMLElement) {
  const text = canvasElement.textContent ?? "";
  for (const bad of FORBIDDEN) {
    await expect(text.includes(bad)).toBe(false);
  }
  // B1/B2/B3 present.
  for (const id of ["B1", "B2", "B3"]) {
    await expect(text.includes(id)).toBe(true);
  }
  // Source health + proof link always present.
  await expect(text.includes("Source health")).toBe(true);
  await expect(text.includes("Proof Center")).toBe(true);
  // No fake BTC curve — this instrument renders no <path> price curve.
  await expect(canvasElement.querySelector("path[data-btc-curve]")).toBeNull();
}

export const LiveFullData: Story = {
  args: {
    target: TARGET,
    actual: ACTUAL,
    sources: [
      { label: "Vault", status: "live" },
      { label: "Strategies", status: "live" },
      { label: "Mining", status: "live" },
    ],
    proof: { lastEventLabel: "Deposit", chainLabel: "Fork preprod" },
    subscription: { minimum: "$100,000", hardCap: "$1,000,000" },
  },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    // Real drift shown (both inputs present): B1 = +2.0 pt.
    await expect(canvas.getByText("+2.0 pt")).toBeVisible();
  },
};

export const TargetOnly: Story = {
  args: {
    target: TARGET,
    actual: null,
    actualMotive: "the measured pocket allocation appears once the v2.1 contract is deployed",
    sources: [
      { label: "Vault", status: "live" },
      { label: "Strategies", status: "not_configured" },
    ],
    proof: { lastEventLabel: null, chainLabel: null },
    subscription: { minimum: null, hardCap: null },
  },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    // No fabricated drift when actual is absent.
    await expect(canvas.getByText(/Not available — a live on-chain split/)).toBeVisible();
  },
};

export const ActualUnavailable: Story = {
  args: {
    target: TARGET,
    actual: null,
    actualMotive: "the on-chain read did not answer",
    sources: [
      { label: "Vault", status: "unavailable" },
      { label: "Strategies", status: "unavailable" },
    ],
    proof: { lastEventLabel: null, chainLabel: null },
    subscription: { minimum: null, hardCap: null },
  },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    await expect(canvas.getAllByText(/Unavailable/).length).toBeGreaterThan(0);
  },
};

export const AllNotConfigured: Story = {
  args: {
    target: TARGET,
    actual: null,
    actualMotive: "no contract configured on this network yet",
    sources: [
      { label: "Vault", status: "not_configured" },
      { label: "Strategies", status: "not_configured" },
      { label: "Mining", status: "not_configured" },
    ],
    proof: { lastEventLabel: null, chainLabel: null },
    subscription: { minimum: null, hardCap: null },
  },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    await expect(canvas.getByText("No event indexed yet")).toBeVisible();
    await expect(canvas.getByText("Cap not reported")).toBeVisible();
  },
};

export const ForkProofAvailable: Story = {
  args: {
    target: TARGET,
    actual: ACTUAL,
    sources: [{ label: "Vault", status: "live" }],
    proof: { lastEventLabel: "MiningMetricsReported", chainLabel: "Fork preprod" },
    subscription: { minimum: "$100,000", hardCap: "$1,000,000" },
  },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    await expect(canvas.getByText("MiningMetricsReported")).toBeVisible();
    await expect(canvas.getByText(/Fork preprod/)).toBeVisible();
  },
};

export const NarrowViewport: Story = {
  args: {
    target: TARGET,
    actual: ACTUAL,
    sources: [{ label: "Vault", status: "live" }],
    proof: { lastEventLabel: "Deposit", chainLabel: "Fork preprod" },
    subscription: { minimum: "$100,000", hardCap: "$1,000,000" },
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
  },
};

export const WideViewport: Story = {
  args: {
    target: TARGET,
    actual: ACTUAL,
    sources: [{ label: "Vault", status: "live" }],
    proof: { lastEventLabel: "Deposit", chainLabel: "Fork preprod" },
    subscription: { minimum: "$100,000", hardCap: "$1,000,000" },
  },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
  },
};
