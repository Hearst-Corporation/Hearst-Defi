import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real /portfolio chart band, imported as-is and driven with
// test-only backend-shaped fixtures. Covers the states the page must render:
// live allocation + capacity, target-only (no on-chain split yet), and the
// honest empty state when a block is unavailable.
import { PositionCharts } from "@/app/(product)/portfolio/_charts/position-charts";
import type {
  MyPositionCapacity,
  MyPositionPocket,
  PositionActivityItem,
} from "@/app/(product)/portfolio/_data/position-loader";
import type { WiredFromBackend } from "@/lib/backend/resolved-view";

const wired = <T,>(data: T): WiredFromBackend<T> => ({
  status: "wired",
  data,
  source: "v2",
  address: "0xVAULT",
  chainId: 8453,
  readAt: "2026-07-25T05:22:00.000Z",
});

const UNAVAILABLE: WiredFromBackend<never> = {
  status: "unavailable",
  reason: "backend:unreachable",
};

const POCKETS_TARGET: readonly MyPositionPocket[] = [
  { pocket: "B1", label: "Mining Power", targetBps: 4000, actualBps: null },
  { pocket: "B2", label: "BTC Reserve", targetBps: 2700, actualBps: null },
  { pocket: "B3", label: "Operating Reserve", targetBps: 3300, actualBps: null },
];

const POCKETS_ACTUAL: readonly MyPositionPocket[] = [
  { pocket: "B1", label: "Mining Power", targetBps: 4000, actualBps: 3960 },
  { pocket: "B2", label: "BTC Reserve", targetBps: 2700, actualBps: 2740 },
  { pocket: "B3", label: "Operating Reserve", targetBps: 3300, actualBps: 3300 },
];

const CAPACITY: MyPositionCapacity = {
  committed: "4740000",
  available: "255260000",
  cap: "260000000",
  utilizationBps: 182,
};

const ACTIVITY: readonly PositionActivityItem[] = [
  { type: "deposit", amountUsdc: "100000", occurredAt: "2026-02-01T00:00:00Z", txHash: "0x1" },
  { type: "deposit", amountUsdc: "250000", occurredAt: "2026-03-01T00:00:00Z", txHash: "0x2" },
  { type: "withdraw", amountUsdc: "50000", occurredAt: "2026-04-01T00:00:00Z", txHash: "0x3" },
  { type: "deposit", amountUsdc: "180000", occurredAt: "2026-05-01T00:00:00Z", txHash: "0x4" },
];

const meta: Meta<typeof PositionCharts> = {
  title: "05-pages/PositionCharts",
  component: PositionCharts,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof PositionCharts>;

export const LiveActualSplit: Story = {
  args: { allocation: wired(POCKETS_ACTUAL), capacity: wired(CAPACITY), activity: ACTIVITY },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent ?? "";
    await expect(text.includes("Strategy composition")).toBe(true);
    await expect(text.includes("Capacity mix")).toBe(true);
    // No red / yield vocabulary on an investor chart surface.
    for (const bad of ["yield", "APY", "coupon"]) {
      await expect(text.includes(bad)).toBe(false);
    }
  },
};

export const TargetOnly: Story = {
  args: { allocation: wired(POCKETS_TARGET), capacity: wired(CAPACITY), activity: ACTIVITY },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent ?? "";
    // Target-only allocation is labelled as the configured policy, not measured.
    await expect(text.includes("Target")).toBe(true);
  },
};

export const Unavailable: Story = {
  args: { allocation: UNAVAILABLE, capacity: UNAVAILABLE, activity: [] },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent ?? "";
    // Cards still render their titles; the donuts fall to their empty state.
    await expect(text.includes("Strategy composition")).toBe(true);
  },
};
