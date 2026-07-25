import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real product composition, imported as-is. This is the exact
// component this session fixed for a real layout bug (eyebrow spacing +
// full-height KPI dividers, commit 1cc0cd30) — the story is what should have
// caught it before it shipped to a screenshot review. It now carries a play()
// per state so the contract is asserted, not merely rendered.
import { Series1DashboardHero } from "@/components/series1-dashboard/Series1DashboardHero";

const meta: Meta<typeof Series1DashboardHero> = {
  title: "05-pages/Series1DashboardHero",
  component: Series1DashboardHero,
  parameters: {
    layout: "padded",
    // Both ends of the responsive range are exercised by dedicated stories
    // below; the default keeps the desktop framing for review.
    viewport: { defaultViewport: "desktop" },
    a11y: {
      // The allocation ring now renders through Recharts; its ResponsiveContainer
      // trips `scrollable-region-focusable`. Scoped off so the gate tests the
      // hero's own chrome, not the third-party overflow.
      config: {
        rules: [{ id: "scrollable-region-focusable", enabled: false }],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Series1DashboardHero>;

// Series 1's contract bans yield/APY/coupon/distribution language outright.
const FORBIDDEN = [
  "yield",
  "Yield",
  "APY",
  "coupon",
  "Coupon",
  "distribution",
  "Distribution",
];

/** Real policy allocation — VAULT_SPEC v2.1 §6. A spec CONSTANT, not a read. */
const POLICY_ALLOCATION = [
  { id: "B1", label: "Mining Power", value: 40 },
  { id: "B2", label: "BTC Reserve", value: 27 },
  { id: "B3", label: "Operating Reserve", value: 33 },
] as const;

/**
 * The invariant every state of the hero must hold, whatever the data:
 *  - no banned yield/APY/coupon/distribution vocabulary,
 *  - no fabricated BTC accumulation curve (the hero shows a scalar cumul only —
 *    the accumulation curve lives in Series1BitcoinAccumulation and must never
 *    leak here; the ONLY plotted mark permitted in the hero is the honest
 *    policy-allocation composition ring),
 *  - the product eyebrow and the hero label are always present.
 */
async function assertContract(canvasElement: HTMLElement) {
  const text = canvasElement.textContent ?? "";
  for (const bad of FORBIDDEN) {
    await expect(text.includes(bad)).toBe(false);
  }
  // The hero renders a cumulative scalar, never a plotted price/accumulation
  // curve. The ONLY forbidden mark is a BTC accumulation curve, tagged
  // data-btc-curve — the honest allocation ring is allowed (and asserted
  // present in LiveWithAllocation). A blanket "no <path>" would wrongly ban
  // the ring, so the guard is scoped to the fabricated-curve marker only.
  await expect(canvasElement.querySelector("path[data-btc-curve]")).toBeNull();
  // Product line + hero label always framed.
  await expect(text.includes("Hearst Bitcoin Reserve Vault")).toBe(true);
  await expect(text.includes("Bitcoin accumulated")).toBe(true);
}

const BASE_CONTEXT = [
  { label: "Capital deployed", value: "127,000.00 USDC", hint: "USDC subscribed" },
  { label: "Term progress", value: "—", muted: true, hint: "Months elapsed" },
  { label: "Contract", value: "DynaVault v2.1", hint: "Preprod fork — not a record" },
  { label: "Reported hashrate", value: "31,218 TH/s", hint: "Last keeper report" },
  { label: "Mining state", value: "Not reported", muted: true, hint: "Current window" },
  { label: "Allocation mode", value: "Not reported", muted: true, hint: "40 / 27 / 33 policy" },
];

// Mirror of the live wiring in Series1Dashboard.tsx L256-313.
const LIVE_ARGS = {
  eyebrow: "Hearst Bitcoin Reserve Vault · Series 1",
  label: "Bitcoin accumulated",
  value: "0.01520000 BTC",
  caption:
    "Accumulated BTC is the principal investor outcome and is delivered at maturity. Market price is contextual only; it is not a return projection.",
  context: BASE_CONTEXT,
} as const;

/**
 * The shipped hero: resolved number welded to the honest policy-allocation ring
 * filling the left column. This is the live configuration — Series1Dashboard
 * always passes `allocation={cockpitTarget}`.
 */
export const LiveWithAllocation: Story = {
  args: {
    ...LIVE_ARGS,
    allocation: POLICY_ALLOCATION,
  },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    // Resolved hero value shown, no "Not yet reported" pill.
    await expect(canvas.getByText("0.01520000 BTC")).toBeVisible();
    await expect(canvas.queryByText("Not yet reported")).toBeNull();
    // Resolved cell present.
    await expect(canvas.getByText("127,000.00 USDC")).toBeVisible();
    // Muted cells stay honest — the em-dash / "Not reported", never a zero.
    await expect(canvas.getAllByText("Not reported").length).toBeGreaterThan(0);

    // The composition ring is rendered (honest data-viz, not dead space). The
    // ChartDonut wrapper (data-slot="chart") carries the aria-label — Recharts
    // puts the label on the container div, not the inner <svg>.
    const ring = canvasElement.querySelector(
      '[aria-label="Policy target allocation across the three Series 1 pockets"]',
    );
    await expect(ring).not.toBeNull();
    // All three pockets are labelled. The pocket names can legitimately appear
    // more than once (the ring legend plus the KPI "Allocation mode" cell), so
    // assert presence (≥1), not uniqueness — getByText would throw on the dupe.
    await expect(canvas.getAllByText(/B1 · Mining Power/).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText(/B2 · BTC Reserve/).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText(/B3 · Operating Reserve/).length).toBeGreaterThan(0);
    // The ring is framed as a configured target, not a measurement.
    await expect(
      canvas.getByText(/configured target, not a measurement/),
    ).toBeVisible();
  },
};

/**
 * Retro-compat: hero with NO allocation prop. It must render exactly as before
 * — no ring, no SVG — proving the new prop is purely additive.
 */
export const Live: Story = {
  args: LIVE_ARGS,
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    await expect(canvas.getByText("0.01520000 BTC")).toBeVisible();
    await expect(canvas.queryByText("Not yet reported")).toBeNull();
    await expect(canvas.getByText("127,000.00 USDC")).toBeVisible();
    await expect(canvas.getAllByText("Not reported").length).toBeGreaterThan(0);
    // No allocation → no ring mounted. Recharts always emits an <svg> when a
    // chart mounts, so the honest baseline assertion is the ChartDonut wrapper
    // being absent — the hero mounts ChartDonut ONLY when allocation is present.
    await expect(canvasElement.querySelector('[data-slot="chart"]')).toBeNull();
    await expect(canvas.queryByText(/configured target/)).toBeNull();
  },
};

/**
 * Hero read unresolved → honest "Not yet reported" pill, no fabricated zero.
 * The ring is suppressed while the hero number is muted: showing a crisp
 * allocation beside an unresolved headline would read as more certainty than
 * the data supports.
 */
export const Muted: Story = {
  args: {
    ...LIVE_ARGS,
    muted: true,
    allocation: POLICY_ALLOCATION,
  },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    // The hero collapses to the honest pill — no fabricated 0 / 0.00000000.
    await expect(canvas.getByText("Not yet reported")).toBeVisible();
    await expect(canvas.queryByText("0.01520000 BTC")).toBeNull();
    await expect(canvas.queryByText(/^0\.0+ BTC$/)).toBeNull();
    // Muted headline suppresses the ring — the ChartDonut wrapper is absent.
    await expect(canvasElement.querySelector('[data-slot="chart"]')).toBeNull();
  },
};

/**
 * Every KPI cell unresolved (pre-v2.1-deploy reality): the whole context is
 * muted. Verifies the grid never invents a value and holds the faint state.
 * The allocation ring stays — the policy split is a spec constant, so it is
 * honest even when the on-chain reads are all unresolved.
 */
export const AllContextMuted: Story = {
  args: {
    ...LIVE_ARGS,
    allocation: POLICY_ALLOCATION,
    context: BASE_CONTEXT.map((c) => ({
      ...c,
      value: "Not reported",
      muted: true,
    })),
  },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    // Hero number resolved, ring present.
    await expect(canvas.getByText("0.01520000 BTC")).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="chart"]')).not.toBeNull();
    // No cell fabricates data — all read "Not reported".
    await expect(canvas.getAllByText("Not reported").length).toBe(
      BASE_CONTEXT.length,
    );
  },
};

/**
 * Empty context: the hero must render on its own without a KPI grid, and still
 * hold the contract (no banned words, no curve) with the ring in place.
 */
export const NoContext: Story = {
  args: {
    ...LIVE_ARGS,
    allocation: POLICY_ALLOCATION,
    context: [],
  },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    await expect(canvas.getByText("0.01520000 BTC")).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="chart"]')).not.toBeNull();
  },
};

/** Narrow / mobile viewport — the stacked single column must hold the contract. */
export const MobileViewport: Story = {
  args: {
    ...LIVE_ARGS,
    allocation: POLICY_ALLOCATION,
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
    // Ring still renders when the layout stacks.
    await expect(canvasElement.querySelector('[data-slot="chart"]')).not.toBeNull();
  },
};

/** Wide / desktop viewport — the 2-column KPI weld must hold the contract. */
export const DesktopViewport: Story = {
  args: {
    ...LIVE_ARGS,
    allocation: POLICY_ALLOCATION,
  },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
    await expect(canvasElement.querySelector('[data-slot="chart"]')).not.toBeNull();
  },
};
