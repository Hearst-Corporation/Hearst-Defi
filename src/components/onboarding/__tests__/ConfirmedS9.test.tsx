/**
 * S9 Confirmed page — structural presence tests.
 *
 * Verifies that the confirmation page contains all required elements:
 *   1. TX hash area
 *   2. [manual] provenance badge (txHash is a URL param, not server-attested)
 *   3. Base Sepolia explorer link
 *   4. Vault contract address — env-gated, no fabricated stub
 *   5. NAV at entry "1.0000 USDC / share" [manual]
 *   6. Soft-lock progress bar (role=progressbar) — contractual, not on-chain
 *   7. "Day 0 of 60" text
 *   8. Ops contact card (Sarah Chen, IR)
 *   9. "Go to portfolio" primary CTA
 *  10. Receipt email notice
 *  11. "not guaranteed" disclaimer
 *
 * v2 note-of-mining model: there is NO periodic cash distribution, so the page
 * no longer surfaces a "Next distribution" row or a calendar (.ics) download.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it, expect, vi } from "vitest";

// The confirmed page resolves the investor server-side and only surfaces the
// position when it BELONGS to that investor (the positionId query param is
// untrusted). Resolve a real investor so the ownership-checked branch — the
// one these structural tests assert (position ID row, progress bar, position
// CTA) — is exercised.
vi.mock("@/lib/auth/session", () => ({
  getInvestor: vi.fn().mockResolvedValue({ id: "inv_test" }),
}));

// The page resolves the position via an ownership-scoped findFirst
// ({ id, investorId }) to compute the REAL elapsed soft-lock day (audit I16: no
// fabricated 0% — the progress bar only renders when an OWNED position
// resolves) and to display the DB principal as the amount (the `amount` query
// param is untrusted). Fresh confirmation: subscribedAt = now → "Day 0 of 60".
// `vaultDeployment`/`vaultSnapshot` are mocked because `getVault()` no longer
// swallows a DB failure into `null`: an outage used to be indistinguishable
// from "no such vault", so the page 404'd during an incident. Now the error
// propagates, which means an unmocked Prisma client fails this test loudly
// instead of silently exercising the not-found path.
vi.mock("@/lib/db", () => ({
  prisma: {
    position: {
      findFirst: vi.fn().mockResolvedValue({
        subscribedAt: new Date(),
        principalUsdc: 500_000,
      }),
    },
    vaultDeployment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    vaultSnapshot: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// The confirmed page now reads NAV/share through the chain adapter (the single
// passage point) instead of the old hard-coded "1.0000 USDC / share" fallback,
// which was a fabricated number wearing an "estimated" badge — exactly the
// fake-live this codebase forbids. In the test environment no contract address
// is configured, so an UNMOCKED read returns `unavailable` and the page renders
// an em-dash (the correct, honest degraded state). We mock a WIRED read here so
// this test asserts the real thing it cares about: that the page renders the NAV
// the chain gives it. `getVaultTarget` is mocked to "not_configured" so the
// env-gated contract-address row stays hidden (the "no fabricated stub" test).
vi.mock("@/lib/chain/dynavault", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/chain/dynavault")>();
  return {
    ...actual,
    getVaultTarget: vi.fn(() => ({ mode: "not_configured" as const })),
    // 1_000_000 raw asset units at 6 asset-decimals = 1.0000 USDC / share.
    // shareDecimals: 6 is v2's truth (shares "1:1" with USDC), not the legacy 18.
    readNavPerShare: vi.fn().mockResolvedValue({
      status: "wired",
      data: { raw: 1_000_000n, assetDecimals: 6, shareDecimals: 6 },
      source: "v2",
      address: "0x2bd14d52518a04f4c12949c51df03a161a9e329e",
      chainId: 84532,
      readAt: new Date(0).toISOString(),
    }),
  };
});

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

  it("frames the soft-lock as contractual, not on-chain (v2 note of mining)", async () => {
    const html = await getHtml();
    expect(html).toContain("contractual");
    // v2 has no periodic cash distribution — no calendar download, no payout row.
    expect(html).not.toContain(".ics");
    expect(html).not.toContain("Next distribution");
    expect(html).not.toContain("Add to calendar");
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
    expect(html).toContain("Methodology v3.0 PDF");
    // The notice is generic ("your registered address") on purpose: the page does
    // NOT echo a URL-supplied email back into the document (unverified input).
    expect(html).toContain("will be emailed to your registered address");
    expect(html).not.toContain("investor@firm.com");
  });


  it("renders bento step-4 layout with the funnel step indicator and actions", async () => {
    const html = await getHtml();
    // Step indicator (a11y progressbar) — funnel step 4, Confirmed.
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuetext="Step 4 of 4: Confirmed"');
    expect(html).not.toMatch(/eyebrow[^>]*>Invest · Step/);
    // Bento panels (Portfolio canon), not the legacy product-doc / vault-panel DS.
    expect(html).toContain("rounded-2xl");
    expect(html).toContain("bg-surface-card");
    expect(html).not.toContain("vault-panel-row");
    expect(html).not.toContain("vault-panel-inset-block");
    // Single-product cockpit: no "other products" to browse.
    expect(html).toContain("Back to the vault");
    expect(html).not.toContain("View other products");
  });
});
