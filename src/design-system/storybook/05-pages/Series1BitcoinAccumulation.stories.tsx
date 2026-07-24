import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real dashboard card, imported as-is.
import { Series1BitcoinAccumulation } from "@/components/series1-dashboard/Series1BitcoinAccumulation";

const meta: Meta<typeof Series1BitcoinAccumulation> = {
  title: "05-pages/Series1BitcoinAccumulation",
  component: Series1BitcoinAccumulation,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1BitcoinAccumulation>;

// Series 1 forbids yield/APY/coupon/distribution and any fabricated BTC curve.
const FORBIDDEN = [
  "yield",
  "Yield",
  "APY",
  "coupon",
  "Coupon",
  "distribution",
  "Distribution",
];

/**
 * The invariant this card must ALWAYS satisfy, whatever its inputs:
 *   - no forbidden lexicon (the Series 1 contract bans it);
 *   - no fabricated time series — the honest empty-state text is present and
 *     there is NO rendered price/accumulation path;
 *   - the header identity is stable.
 */
async function assertContract(canvasElement: HTMLElement) {
  const text = canvasElement.textContent ?? "";
  for (const bad of FORBIDDEN) {
    await expect(text.includes(bad)).toBe(false);
  }
  // Card identity + the honest series-absence explanation, always.
  await expect(text.includes("Accumulated Bitcoin")).toBe(true);
  await expect(text.includes("No accumulation series yet")).toBe(true);
  await expect(text.includes("cumulative total, not a per-month series")).toBe(true);
  // The card exposes the cumulative scalar slot, always.
  await expect(text.includes("Cumulative to date")).toBe(true);
  // No fabricated curve — this card renders no accumulation <path>.
  await expect(canvasElement.querySelector("path[data-btc-curve]")).toBeNull();
  await expect(canvasElement.querySelector("path")).toBeNull();
}

/** Cumulative read resolved: the real scalar is surfaced, no series drawn. */
export const CumulativeLive: Story = {
  args: {
    cumulativeLabel: "0.12345678 BTC",
    motive: null,
  },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
    const text = canvasElement.textContent ?? "";
    // The real cumulative figure is shown; no motive line when it resolved.
    await expect(text.includes("0.12345678 BTC")).toBe(true);
    await expect(text.includes("Not reported")).toBe(false);
  },
};

/** Cumulative read did not resolve: "Not reported", never a fabricated zero. */
export const CumulativeUnavailable: Story = {
  args: {
    cumulativeLabel: null,
    motive: "Reading unavailable",
  },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
    const text = canvasElement.textContent ?? "";
    // Absent scalar reads "Not reported" — honesty canon, never "0 BTC".
    await expect(text.includes("Not reported")).toBe(true);
    await expect(text.includes("0 BTC")).toBe(false);
    await expect(text.includes("0.00000000 BTC")).toBe(false);
    // The group motive is stated once.
    await expect(text.includes("Reading unavailable")).toBe(true);
  },
};

/** Not exposed by the current contract: motive present, still no series. */
export const NotExposedByContract: Story = {
  args: {
    cumulativeLabel: null,
    motive: "Not exposed by contract",
  },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
    const text = canvasElement.textContent ?? "";
    await expect(text.includes("Not exposed by contract")).toBe(true);
    await expect(text.includes("Not reported")).toBe(true);
  },
};

/** Cumulative known but no motive to state — the pure "known cumul" state. */
export const CumulativeNoMotive: Story = {
  args: {
    cumulativeLabel: "1.00000000 BTC",
    motive: null,
  },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
    const text = canvasElement.textContent ?? "";
    await expect(text.includes("1.00000000 BTC")).toBe(true);
  },
};

/** Mobile viewport — the contract holds when the card reflows narrow. */
export const NarrowViewport: Story = {
  args: {
    cumulativeLabel: "0.12345678 BTC",
    motive: null,
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
  },
};

/** Desktop viewport — the contract holds at full width. */
export const WideViewport: Story = {
  args: {
    cumulativeLabel: null,
    motive: "Not exposed by contract",
  },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
  },
};
