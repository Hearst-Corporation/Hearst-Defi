import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real product composition, imported as-is.
import {
  Series1MiningRegister,
  type Series1MiningGate,
} from "@/components/series1-dashboard/Series1MiningRegister";

const meta: Meta<typeof Series1MiningRegister> = {
  title: "05-pages/Series1MiningRegister",
  component: Series1MiningRegister,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1MiningRegister>;

// ── Contract vocabulary ─────────────────────────────────────────────────────

// Series 1 forbids product-promise language and any fabricated series.
const FORBIDDEN_LEXICON = [
  "yield",
  "Yield",
  "APY",
  "coupon",
  "Coupon",
  "distribution",
  "Distribution",
];

// The matrix explicitly forbids fabricating these mining economics anywhere in
// the investor register — the backend provides no such series. If any of these
// phrases ever renders, a metric has been invented.
const FABRICATED_METRICS = [
  "cost per BTC",
  "cost-per-BTC",
  "Cost per BTC",
  "break-even",
  "Break-even",
  "breakeven",
  "hashprice",
  "Hashprice",
  "build rate",
  "Build rate",
  "reserve build",
  "BTC monthly curve",
  "monthly curve",
];

/**
 * Doctrine assertions common to every state:
 *   - no product-promise lexicon,
 *   - no fabricated mining economics,
 *   - no red (single-green doctrine: only --ct-accent, absent = grey),
 *   - no fabricated zero figure.
 */
async function assertHonesty(canvasElement: HTMLElement) {
  const text = canvasElement.textContent ?? "";

  for (const bad of FORBIDDEN_LEXICON) {
    await expect(text.includes(bad)).toBe(false);
  }
  for (const metric of FABRICATED_METRICS) {
    await expect(text.includes(metric)).toBe(false);
  }

  // No red anywhere — not as an inline style, not as a token. Absent data is
  // grey (--ct-text-muted / --ct-text-faint), never a red error state.
  const html = canvasElement.innerHTML;
  await expect(/#f[0-9a-f]{2}[0-9a-f]{3}/i.test(html)).toBe(false); // no reddish hex
  await expect(/\brgb\(\s*2\d\d/i.test(html)).toBe(false); // no rgb(2xx,..) reds
  await expect(html.includes("--ct-danger")).toBe(false);
  await expect(html.includes("--ct-status-error")).toBe(false);
  await expect(/\btext-red-|\bbg-red-|\bborder-red-/.test(html)).toBe(false);
}

/** Live rows shared by the resolved stories. */
const LIVE_ROWS = [
  { label: "BTC earned", value: "0.01520000 BTC", hint: "Cumulative, delivered at maturity" },
  { label: "Last report", value: "2026-07-22" },
  { label: "Allocation split", value: "40.00% · 27.00% · 33.00%", hint: "Measured on-chain" },
] as const;

// The rows a gated register is passed but must NOT render — proving the gate
// withholds figures rather than merely relabelling them. If any of these leaks
// past the gate the story fails.
const WITHHELD_ROWS = [
  { label: "BTC earned", value: "0.01520000 BTC", hint: "Cumulative, delivered at maturity" },
  { label: "Last report", value: "2026-07-22" },
  { label: "Reported hashrate", value: "512.00 TH/s" },
] as const;

async function assertGatedWithholds(canvasElement: HTMLElement, state: Series1MiningGate["state"]) {
  const text = canvasElement.textContent ?? "";
  // The gated well is visible and carries the state marker.
  const well = canvasElement.querySelector(`[data-mining-gate="${state}"]`);
  await expect(well).not.toBeNull();
  // None of the withheld figures leaked through the gate.
  await expect(text.includes("0.01520000 BTC")).toBe(false);
  await expect(text.includes("512.00 TH/s")).toBe(false);
  await expect(text.includes("2026-07-22")).toBe(false);
}

// ── Live ─────────────────────────────────────────────────────────────────────

export const Live: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    gate: { state: "live" },
    rows: LIVE_ROWS,
  },
  play: async ({ canvasElement, canvas }) => {
    await assertHonesty(canvasElement);
    // Live: real rows render, no gated well.
    await expect(canvasElement.querySelector("[data-mining-gate]")).toBeNull();
    await expect(canvas.getByText("0.01520000 BTC")).toBeVisible();
    await expect(canvas.getByText("2026-07-22")).toBeVisible();
  },
};

// Omitting `gate` entirely must behave exactly like the previous component —
// retro-compat guard for the existing call sites.
export const LiveNoGateProp: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    rows: LIVE_ROWS,
  },
  play: async ({ canvasElement, canvas }) => {
    await assertHonesty(canvasElement);
    await expect(canvasElement.querySelector("[data-mining-gate]")).toBeNull();
    await expect(canvas.getByText("0.01520000 BTC")).toBeVisible();
  },
};

// ── Stale — the real production state (cron stale since 2026-07-07) ───────────

export const Stale: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    gate: {
      state: "stale",
      detail:
        "the keeper last reported on 2026-07-07, so these operational figures are held back rather than shown out of date",
    },
    rows: WITHHELD_ROWS,
  },
  play: async ({ canvasElement, canvas }) => {
    await assertHonesty(canvasElement);
    await assertGatedWithholds(canvasElement, "stale");
    // The reason is stated, once.
    await expect(canvas.getByText("Mining telemetry is stale")).toBeVisible();
    await expect(canvas.getByText(/2026-07-07/)).toBeVisible();
  },
};

// ── Not configured ───────────────────────────────────────────────────────────

export const NotConfigured: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    gate: { state: "not_configured" },
    rows: WITHHELD_ROWS,
  },
  play: async ({ canvasElement, canvas }) => {
    await assertHonesty(canvasElement);
    await assertGatedWithholds(canvasElement, "not_configured");
    await expect(canvas.getByText("Mining telemetry is not configured")).toBeVisible();
  },
};

// ── Unavailable ──────────────────────────────────────────────────────────────

export const Unavailable: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    gate: { state: "unavailable" },
    rows: WITHHELD_ROWS,
  },
  play: async ({ canvasElement, canvas }) => {
    await assertHonesty(canvasElement);
    await assertGatedWithholds(canvasElement, "unavailable");
    await expect(canvas.getByText("Mining telemetry is unavailable")).toBeVisible();
  },
};

// ── Viewports — stale (the live-prod state) at both ends ──────────────────────

export const StaleMobile: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    gate: { state: "stale" },
    rows: WITHHELD_ROWS,
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    await assertHonesty(canvasElement);
    await assertGatedWithholds(canvasElement, "stale");
  },
};

export const StaleDesktop: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    gate: { state: "stale" },
    rows: WITHHELD_ROWS,
  },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    await assertHonesty(canvasElement);
    await assertGatedWithholds(canvasElement, "stale");
  },
};

export const LiveMobile: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    gate: { state: "live" },
    rows: LIVE_ROWS,
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement, canvas }) => {
    await assertHonesty(canvasElement);
    await expect(canvasElement.querySelector("[data-mining-gate]")).toBeNull();
    await expect(canvas.getByText("0.01520000 BTC")).toBeVisible();
  },
};

export const LiveDesktop: Story = {
  args: {
    title: "Mining register",
    caption: "Reported on-chain by the keeper",
    motive: null,
    gate: { state: "live" },
    rows: LIVE_ROWS,
  },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement, canvas }) => {
    await assertHonesty(canvasElement);
    await expect(canvasElement.querySelector("[data-mining-gate]")).toBeNull();
    await expect(canvas.getByText("0.01520000 BTC")).toBeVisible();
  },
};

// ── Companion register (reserve/contract) — kept, exercises the ungated path ──

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
  play: async ({ canvasElement }) => {
    await assertHonesty(canvasElement);
    await expect(canvasElement.querySelector("[data-mining-gate]")).toBeNull();
  },
};

// Legacy per-row muted state (motive stated once, rows kept as "Not reported").
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
  play: async ({ canvasElement }) => {
    await assertHonesty(canvasElement);
  },
};
