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

// The FOUR investor destinations this rail must expose (nav doctrine 2026-07-25,
// MONDE B): Position · Reserve · Proof · Profile. One flat rail. The investor
// home is "Position" (/portfolio), backend-sourced; the retired fund-level
// /dashboard overview redirects there and is NOT a rail item.
const EXPECTED_LABELS = ["Position", "Reserve", "Proof", "Profile"];

// The exact ordered destination set — the navigation surface, nothing else.
const EXPECTED_HREFS = ["/portfolio", "/vaults", "/proof-center", "/profile"];

// Href prefixes that must NEVER be a destination in the investor rail: admin,
// webhooks/API plumbing, and the folded off-canon Portfolio sub-pages. Note
// `/portfolio` itself IS the home now — only its off-canon sub-pages are barred.
const FORBIDDEN_HREF_PREFIXES = [
  "/admin",
  "/api/",
  "/portfolio/yield",
  "/portfolio/distributions",
];

// Destinations RETIRED from the rail by the doctrine — each folds INTO one of
// the four (Bitcoin Constitution → Reserve, Documents/KYC → Profile). The
// former fund-level Dashboard is retired as the landing (redirects to Position).
// They must not stand as their own link.
const RETIRED_HREFS = ["/dashboard", "/bitcoin-constitution"];

// Labels the rail must NOT show — the retired standalone entries and the plural
// "Vaults" wording. "Series 1" is a header subtitle/badge, never a nav label.
const RETIRED_LABELS = [
  "Dashboard",
  "Bitcoin Constitution",
  "Documents & KYC",
  "Series 1 Vault",
  "Vaults",
  "Overview",
];

// The contract is the set of link destinations + their visible labels, not the
// raw innerHTML (which carries CSS classes and runtime Headless UI ids). We
// assert on hrefs and accessible text only — the actual navigation surface.
async function assertFourCleanItems(canvasElement: HTMLElement) {
  const links = Array.from(canvasElement.querySelectorAll("a[href]"));
  // Exactly four navigable investor destinations — one flat rail.
  await expect(links.length).toBe(4);

  const hrefs = links.map((a) => a.getAttribute("href") ?? "");
  await expect(hrefs).toEqual(EXPECTED_HREFS);

  // No admin, no webhook/API route, no promoted off-canon Portfolio sub-page.
  for (const href of hrefs) {
    for (const bad of FORBIDDEN_HREF_PREFIXES) {
      await expect(href.startsWith(bad)).toBe(false);
    }
  }

  // Retired destinations do not stand alone in the rail.
  for (const gone of RETIRED_HREFS) {
    await expect(hrefs.includes(gone)).toBe(false);
  }

  const linkText = links.map((a) => a.textContent ?? "").join(" | ");
  // Every one of the four labels is present as link text.
  for (const label of EXPECTED_LABELS) {
    await expect(linkText.includes(label)).toBe(true);
  }
  // None of the retired labels leaks back in. ("Series 1" alone is allowed —
  // it is the header subtitle — but never as "Series 1 Vault" nav wording.)
  for (const gone of RETIRED_LABELS) {
    await expect(linkText.includes(gone)).toBe(false);
  }
}

export const Default: Story = {
  args: { pathname: "/portfolio" },
  play: async ({ canvasElement }) => {
    await assertFourCleanItems(canvasElement);
  },
};

export const ActivePosition: Story = {
  args: { pathname: "/portfolio" },
  play: async ({ canvasElement, canvas }) => {
    await assertFourCleanItems(canvasElement);
    const active = canvas.getByRole("link", { name: /Position/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const ActiveReserve: Story = {
  args: { pathname: "/vaults" },
  play: async ({ canvasElement, canvas }) => {
    await assertFourCleanItems(canvasElement);
    const active = canvas.getByRole("link", { name: /Reserve/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const ActiveProof: Story = {
  args: { pathname: "/proof-center" },
  play: async ({ canvasElement, canvas }) => {
    await assertFourCleanItems(canvasElement);
    const active = canvas.getByRole("link", { name: /Proof/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const ActiveProfile: Story = {
  args: { pathname: "/profile" },
  play: async ({ canvasElement, canvas }) => {
    await assertFourCleanItems(canvasElement);
    const active = canvas.getByRole("link", { name: /Profile/ });
    await expect(active).toHaveAttribute("data-current", "true");
  },
};

export const NarrowViewport: Story = {
  args: { pathname: "/portfolio" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    await assertFourCleanItems(canvasElement);
  },
};

export const WideViewport: Story = {
  args: { pathname: "/portfolio" },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    await assertFourCleanItems(canvasElement);
  },
};
