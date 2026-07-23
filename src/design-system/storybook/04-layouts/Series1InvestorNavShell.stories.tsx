import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real investor rail, imported as-is. `pathname` is a prop, so
// each active state is just a different arg — no router mock needed.
import { Series1Nav } from "@/components/series1-shell/Series1Nav";

const meta: Meta<typeof Series1Nav> = {
  title: "04-layouts/Series1InvestorNavShell",
  component: Series1Nav,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof Series1Nav>;

// The six investor surfaces this rail must expose (PROMPT 027), by label.
const EXPECTED_LABELS = [
  "Overview",
  "Bitcoin Constitution",
  "Series 1 Vault",
  "My Position",
  "Proof Center",
  "Documents & KYC",
];

// Href prefixes that must NEVER be a destination in the investor rail:
// admin, webhooks/API plumbing, and the folded (off-canon) Portfolio sub-pages.
const FORBIDDEN_HREF_PREFIXES = [
  "/admin",
  "/api/",
  "/portfolio/yield",
  "/portfolio/distributions",
];

// The contract is the set of link destinations + their visible labels, not the
// raw innerHTML (which carries CSS classes and runtime Headless UI ids). We
// assert on hrefs and accessible text only — the actual navigation surface.
async function assertSixCleanItems(canvasElement: HTMLElement) {
  const links = Array.from(canvasElement.querySelectorAll("a[href]"));
  // Exactly six navigable investor surfaces.
  await expect(links.length).toBe(6);

  const hrefs = links.map((a) => a.getAttribute("href") ?? "");
  await expect(hrefs).toEqual([
    "/dashboard",
    "/bitcoin-constitution",
    "/vaults",
    "/portfolio",
    "/proof-center",
    "/profile",
  ]);

  // No admin, no webhook/API route, no promoted off-canon Portfolio sub-page.
  for (const href of hrefs) {
    for (const bad of FORBIDDEN_HREF_PREFIXES) {
      await expect(href.startsWith(bad)).toBe(false);
    }
  }

  // Every expected investor label is present as link text.
  const linkText = links.map((a) => a.textContent ?? "").join(" | ");
  for (const label of EXPECTED_LABELS) {
    await expect(linkText.includes(label)).toBe(true);
  }
}

export const Default: Story = {
  args: { pathname: "/dashboard" },
  play: async ({ canvasElement }) => {
    await assertSixCleanItems(canvasElement);
  },
};

export const ActiveDashboard: Story = {
  args: { pathname: "/dashboard" },
  play: async ({ canvasElement, canvas }) => {
    await assertSixCleanItems(canvasElement);
    const active = canvas.getByRole("link", { name: /Overview/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const ActiveBitcoinConstitution: Story = {
  args: { pathname: "/bitcoin-constitution" },
  play: async ({ canvasElement, canvas }) => {
    await assertSixCleanItems(canvasElement);
    const active = canvas.getByRole("link", { name: /Bitcoin Constitution/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const ActiveVaults: Story = {
  args: { pathname: "/vaults" },
  play: async ({ canvas }) => {
    const active = canvas.getByRole("link", { name: /Series 1 Vault/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const ActivePortfolio: Story = {
  args: { pathname: "/portfolio" },
  play: async ({ canvas }) => {
    const active = canvas.getByRole("link", { name: /My Position/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const ActiveProofCenter: Story = {
  args: { pathname: "/proof-center" },
  play: async ({ canvas }) => {
    const active = canvas.getByRole("link", { name: /Proof Center/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const ActiveProfile: Story = {
  args: { pathname: "/profile" },
  play: async ({ canvas }) => {
    const active = canvas.getByRole("link", { name: /Documents & KYC/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const NarrowViewport: Story = {
  args: { pathname: "/dashboard" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    await assertSixCleanItems(canvasElement);
  },
};

export const WideViewport: Story = {
  args: { pathname: "/dashboard" },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    await assertSixCleanItems(canvasElement);
  },
};
