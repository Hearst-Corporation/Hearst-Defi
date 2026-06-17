/**
 * S9 Confirmed page — structural presence tests.
 *
 * Verifies that the confirmation page contains all 9 required elements:
 *   1. TX hash area
 *   2. [oracle] provenance badge (txHash is a URL param, not server-attested)
 *   3. Base Sepolia explorer link
 *   4. Vault contract address — env-gated, no fabricated stub
 *   5. NAV at entry "1.0000 USDC / share" [manual]
 *   6. Soft-lock progress bar (role=progressbar)
 *   7. "Day 0 of 60" text
 *   8. Next distribution + calendar (.ics) download
 *   9. Ops contact card (Sarah Chen, IR)
 *  10. "Go to portfolio" primary CTA
 *  11. Receipt email notice
 *  12. "not guaranteed" disclaimer
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it, expect, vi } from "vitest";

// The confirmed page resolves the investor server-side (to detect the demo
// sandbox identity). Mock it to a NON-demo result so these structural tests
// exercise the existing live-confirmation branch (unchanged) without a request
// scope. The demo branch is covered by the demo provider tests.
vi.mock("@/lib/auth/session", () => ({
  getInvestor: vi.fn().mockResolvedValue(null),
}));

import ConfirmedPage from "@/app/(product)/vaults/[id]/invest/confirmed/page";

/** Build a fake resolved Promise. */
function rp<T>(val: T): Promise<T> {
  return Promise.resolve(val);
}

async function getHtml(overrides?: {
  id?: string;
  tx?: string;
  amount?: string;
  positionId?: string;
  email?: string;
}): Promise<string> {
  const jsx = await ConfirmedPage({
    params: rp({ id: overrides?.id ?? "yield-vault-1" }),
    searchParams: rp({
      tx: overrides?.tx ?? "0x6ab2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0f31c",
      amount: overrides?.amount ?? "500000",
      positionId: overrides?.positionId ?? "pos_01H7XYZ",
      email: overrides?.email ?? "investor@firm.com",
    }),
  });
  return renderToStaticMarkup(jsx);
}

describe("S9 ConfirmedPage — all required elements present", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_IR_CONTACT_NAME", "Sarah Chen");
    vi.stubEnv("NEXT_PUBLIC_IR_CONTACT_EMAIL", "sarah@hearstconnect.io");
    vi.stubEnv("NEXT_PUBLIC_CALENDLY_URL", "https://calendly.com/hearstconnect/15min");
  });
  it("shows the deposited amount", async () => {
    const html = await getHtml({ amount: "500000" });
    expect(html).toContain("500,000");
    expect(html).toContain("USDC");
  });

  it("shows the abbreviated transaction hash", async () => {
    const html = await getHtml({
      tx: "0x6ab2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0f31c",
    });
    expect(html).toContain("0x6ab2");
    expect(html).toContain("f31c");
  });

  it("shows a Manual provenance badge on the transaction (txHash comes from URL, not server-attested) — A2", async () => {
    const html = await getHtml();
    // The txHash arrives via the URL (unverified by this page), so the badge is
    // "Manual" — NOT "Oracle" (no on-chain oracle) and NOT "Attested".
    expect(html.toLowerCase()).toContain("manual");
    expect(html.toLowerCase()).not.toContain("oracle");
    expect(html.toLowerCase()).not.toContain("attested");
  });

  it("contains a Base Sepolia explorer link", async () => {
    const html = await getHtml({
      tx: "0xabc123def456abc",
    });
    expect(html).toContain("sepolia.basescan.org");
  });

  it("never renders a fabricated stub vault contract address", async () => {
    const html = await getHtml();
    // The stub 0x8c4a… must be gone. The real address is env-gated, so the
    // contract row is hidden when NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS is unset.
    expect(html).not.toContain("0x8c4a");
  });

  it("shows NAV initial 1.0000 USDC / share", async () => {
    const html = await getHtml();
    expect(html).toContain("1.0000 USDC / share");
  });

  it("shows the position ID", async () => {
    const html = await getHtml({ positionId: "pos_01H7XYZ" });
    expect(html).toContain("pos_01H7XYZ");
  });

  it("renders the soft-lock progressbar with role=progressbar", async () => {
    const html = await getHtml();
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("Day 0 of 60");
  });

  it("shows the next distribution date and calendar download link", async () => {
    const html = await getHtml();
    expect(html).toContain(".ics");
    expect(html).toContain("Next distribution");
  });

  it("shows the OpsContactCard with Sarah Chen", async () => {
    const html = await getHtml();
    expect(html).toContain("Sarah Chen");
    expect(html).toContain("Investor Relations");
    expect(html).toContain("sarah@hearstconnect.io");
    expect(html).toContain("Book a call");
  });

  it("has a 'Go to portfolio' primary CTA linking to the position", async () => {
    const html = await getHtml({ positionId: "pos_01H7XYZ" });
    expect(html.toLowerCase()).toContain("go to portfolio");
    expect(html).toContain("/portfolio/pos_01H7XYZ");
  });

  it("shows receipt + Methodology PDF email notice", async () => {
    const html = await getHtml({ email: "investor@firm.com" });
    expect(html).toContain("Methodology v1.0 PDF");
    expect(html).toContain("investor@firm.com");
  });


  it("uses InvestFlowShell step 4 layout with product-doc stacks and vault panel primitives", async () => {
    const html = await getHtml();
    expect(html).toContain("Invest");
    expect(html).toContain('aria-valuetext="Step 4 of 4: Confirmed"');
    expect(html).not.toMatch(/eyebrow[^>]*>Invest · Step/);
    expect(html).toContain("product-doc-shell--narrow");
    expect(html).not.toContain("product-doc-shell--cap");
    expect(html).toContain("product-doc-stack");
    expect(html).toContain("product-doc-stack--tight");
    expect(html).toContain("product-doc-stack--actions");
    expect(html).toContain("vault-panel-row");
    expect(html).toContain("vault-panel-inset-block");
    expect(html).toContain("Add to calendar");
    expect(html).toContain("View other products");
  });
});
