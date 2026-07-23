import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real primitives the unified /portfolio page composes. The page
// itself is an async server component (per-wallet chain reads), so it can't be
// imported directly; this story assembles the SAME real components with
// test-only fixtures to cover the states the page must render.
import { RecentActivity } from "@/components/portfolio/recent-activity";
import {
  Series1Page,
  Series1PageTitle,
  Series1Section,
} from "@/components/series1-shell/Series1Page";
import {
  Series1Panel,
  Series1PanelHeader,
  Series1Row,
  Series1RowList,
} from "@/components/series1-shell/Series1Panel";
import type { PortfolioTransaction } from "@/lib/data/portfolio";

type UnifiedArgs = {
  state: "active" | "empty" | "unavailable" | "onboarding";
};

const ACTIVE_TX: PortfolioTransaction[] = [
  { id: "t1", type: "deposit", amountUsdc: 100000, occurredAt: new Date("2026-07-01T00:00:00Z"), txHash: "0xabc" },
  { id: "t2", type: "distribution", amountUsdc: 0, occurredAt: new Date("2026-07-10T00:00:00Z"), txHash: "0xdef" },
];

function PositionSummary({ state }: UnifiedArgs) {
  const value =
    state === "active" ? "$100,000" : state === "unavailable" ? "Unavailable" : state === "onboarding" ? "Link a wallet" : "—";
  const hint =
    state === "unavailable"
      ? "Contract read failed — this is an outage, not a zero position"
      : state === "onboarding"
        ? "Complete onboarding to see your position"
        : state === "empty"
          ? "No position yet — subscribe on Series 1"
          : "convertToAssets(shares)";
  return (
    <Series1Panel>
      <Series1PanelHeader title="Holdings" description="Read per-wallet from the vault contract." />
      <Series1RowList>
        <Series1Row label="Position value" value={value} hint={hint} />
        <Series1Row label="Periodic cash" value="None" hint="No periodic cash, no fixed rate — BTC delivered at maturity." />
      </Series1RowList>
    </Series1Panel>
  );
}

function UnifiedPortfolio({ state }: UnifiedArgs) {
  const transactions = state === "active" ? ACTIVE_TX : [];
  return (
    <Series1Page>
      <Series1PageTitle
        title="My Position"
        meta="Series 1 · Methodology v3.0"
        description="Your position in the Hearst Bitcoin Reserve Vault — capital deployed, share receipts and delivery at maturity."
      />
      <Series1Section index="01" title="Position detail">
        <PositionSummary state={state} />
      </Series1Section>
      <Series1Section index="02" title="Contribution timeline">
        <RecentActivity transactions={transactions} source={state === "unavailable" ? "fallback" : "live"} />
      </Series1Section>
      <Series1Section index="03" title="Records & proof">
        <Series1Panel>
          <Series1RowList>
            <Series1Row label="Tax preview" value="View YTD preview →" hint="Computed from your ledger" />
            <Series1Row label="On-chain evidence" value="Open Proof Center →" hint="Indexed events and provenance" />
          </Series1RowList>
        </Series1Panel>
      </Series1Section>
    </Series1Page>
  );
}

const meta: Meta<typeof UnifiedPortfolio> = {
  title: "05-pages/Series1PortfolioUnified",
  component: UnifiedPortfolio,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof UnifiedPortfolio>;

// Series 1 forbids yield/APY/coupon language; the timeline never fabricates a
// zero; Proof Center is always linked; no technical sub-nav is rendered.
const FORBIDDEN = ["yield", "Yield", "APY", "coupon", "Coupon"];

async function assertContract(canvasElement: HTMLElement) {
  const text = canvasElement.textContent ?? "";
  for (const bad of FORBIDDEN) {
    await expect(text.includes(bad)).toBe(false);
  }
  // Position summary present.
  await expect(text.includes("Position value")).toBe(true);
  // Records + proof integrated (no separate destination).
  await expect(text.includes("Proof Center")).toBe(true);
  // No technical sub-nav labels leaked into the page.
  for (const leaked of ["distributions", "/portfolio/activity", "positions"]) {
    await expect(text.includes(leaked)).toBe(false);
  }
}

export const ActivePosition: Story = {
  args: { state: "active" },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    // Real activity rows shown, not the empty state.
    await expect(canvas.getByText("Deposit")).toBeVisible();
  },
};

export const EmptyNoPosition: Story = {
  args: { state: "empty" },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    // Honest empty state, no fabricated transactions.
    await expect(canvas.getByText("No transactions yet")).toBeVisible();
  },
};

export const BackendUnavailable: Story = {
  args: { state: "unavailable" },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    await expect(canvas.getByText(/outage, not a zero position/)).toBeVisible();
  },
};

export const OnboardingIncomplete: Story = {
  args: { state: "onboarding" },
  play: async ({ canvasElement, canvas }) => {
    await assertContract(canvasElement);
    await expect(canvas.getByText(/Complete onboarding/)).toBeVisible();
  },
};

export const NarrowViewport: Story = {
  args: { state: "active" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
  },
};

export const WideViewport: Story = {
  args: { state: "active" },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    await assertContract(canvasElement);
  },
};
