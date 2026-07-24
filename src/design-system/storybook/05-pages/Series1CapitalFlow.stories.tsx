import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real product compositions, imported as-is. Both live in the
// "Capital flow / architecture" zone and now share ONE AllocationBarRow.
import {
  Series1CapitalArchitecture,
  Series1CapitalFlow,
  type Series1Pocket,
} from "@/components/series1-dashboard/Series1CapitalArchitecture";

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

/** The real spec-constant target — never invented; the policy split is known. */
const MEASURED: Series1Pocket[] = [
  { id: "B1", label: "Mining Power", value: 40 },
  { id: "B2", label: "BTC Pouch", value: 27 },
  { id: "B3", label: "Reserve USDC", value: 33 },
];

/** A measured on-chain split that drifts from target — the gap is the signal. */
const DRIFTED: Series1Pocket[] = [
  { id: "B1", label: "Mining Power", value: 44 },
  { id: "B2", label: "BTC Pouch", value: 24 },
  { id: "B3", label: "Reserve USDC", value: 32 },
];

/** Lexical guard + no fabricated BTC curve — holds on every story. */
async function assertNoForbidden(canvasElement: HTMLElement) {
  const text = canvasElement.textContent ?? "";
  for (const bad of FORBIDDEN) {
    await expect(text.includes(bad)).toBe(false);
  }
  // This zone renders no <path> price curve — the backend has no monthly series.
  await expect(canvasElement.querySelector("path[data-btc-curve]")).toBeNull();
}

/** Allocation contract: both target and on-chain rows carry B1/B2/B3. */
async function assertAllocationPockets(canvasElement: HTMLElement) {
  const text = canvasElement.textContent ?? "";
  for (const id of ["B1", "B2", "B3"]) {
    await expect(text.includes(id)).toBe(true);
  }
}

const meta: Meta = {
  title: "05-pages/Series1CapitalFlow",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

// ── Capital flow rail (process, no allocation chart) ─────────────────────────

export const FlowRail: Story = {
  render: () => <Series1CapitalFlow />,
  play: async ({ canvasElement, canvas }) => {
    await assertNoForbidden(canvasElement);
    // The four capital-route steps are present, in order.
    await expect(canvas.getByText("USDC subscription")).toBeVisible();
    await expect(canvas.getByText("B1 / B2 / B3 allocation")).toBeVisible();
    await expect(canvas.getByText("BTC reserve ledger")).toBeVisible();
    await expect(canvas.getByText("Delivery at maturity")).toBeVisible();
    // The rail is a numbered process — no allocation bars, so no HcStackedBar.
    await expect(canvasElement.querySelector('[data-hc-ring="segment"]')).toBeNull();
  },
};

export const FlowRailMobile: Story = {
  render: () => <Series1CapitalFlow />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    await assertNoForbidden(canvasElement);
  },
};

// ── Capital architecture (target-vs-on-chain allocation pair) ────────────────

export const ArchitectureMeasured: Story = {
  render: () => <Series1CapitalArchitecture pockets={MEASURED} policyNotice={null} />,
  play: async ({ canvasElement, canvas }) => {
    await assertNoForbidden(canvasElement);
    await assertAllocationPockets(canvasElement);
    // Both rows render: the target and the measured on-chain split.
    await expect(canvas.getByText("Policy target")).toBeVisible();
    await expect(canvas.getByText("On-chain")).toBeVisible();
    // Two filled bar tracks (target + measured on-chain), each with 3 pockets,
    // sharing the ONE deduplicated AllocationBarRow — six filled segments.
    await expect(canvasElement.querySelectorAll('[role="img"]').length).toBe(2);
    await expect(
      canvasElement.querySelectorAll('[data-hc-bar="segment"]').length,
    ).toBe(6);
  },
};

export const ArchitectureDrift: Story = {
  render: () => <Series1CapitalArchitecture pockets={DRIFTED} policyNotice={null} />,
  play: async ({ canvasElement }) => {
    await assertNoForbidden(canvasElement);
    await assertAllocationPockets(canvasElement);
  },
};

export const ArchitecturePolicyOnly: Story = {
  render: () => (
    <Series1CapitalArchitecture
      pockets={[]}
      policyNotice="the measured pocket allocation appears once the v2.1 contract is deployed"
    />
  ),
  play: async ({ canvasElement, canvas }) => {
    await assertNoForbidden(canvasElement);
    // Policy target still shows its B1/B2/B3 spec constant.
    await assertAllocationPockets(canvasElement);
    // On-chain is UNAVAILABLE: an honest hairline track, never a fabricated bar.
    await expect(canvas.getByText("On-chain")).toBeVisible();
    await expect(
      canvas.getByText(/the measured pocket allocation appears/),
    ).toBeVisible();
    await expect(canvas.getByText("Configured policy split")).toBeVisible();
    // Exactly ONE filled bar track (the target). The empty on-chain slot renders
    // a hairline ring div, not a second bar — its three segments are never
    // fabricated, so only the target's three filled segments exist.
    await expect(canvasElement.querySelectorAll('[role="img"]').length).toBe(1);
    await expect(
      canvasElement.querySelectorAll('[data-hc-bar="segment"]').length,
    ).toBe(3);
  },
};

export const ArchitectureMobile: Story = {
  render: () => <Series1CapitalArchitecture pockets={MEASURED} policyNotice={null} />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    await assertNoForbidden(canvasElement);
    await assertAllocationPockets(canvasElement);
  },
};

export const ArchitectureDesktop: Story = {
  render: () => <Series1CapitalArchitecture pockets={MEASURED} policyNotice={null} />,
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    await assertNoForbidden(canvasElement);
    await assertAllocationPockets(canvasElement);
  },
};
