import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TermSheetPreview } from "@/components/vaults/term-sheet-preview";
import type { VaultProduct } from "@/lib/data/vaults";

// Truth-remediation guards (A5 custody, A7 multisig, B4 cadence wording).
// TermSheetPreview is a pure Server Component — render to static markup and
// assert the institutional claims are not presented as unverified truths.

const VAULT: VaultProduct = {
  id: "hearst-yield-vault",
  ticker: "HYV-A",
  name: "Hearst Yield Vault",
  description: "Mining-backed structured yield.",
  strategy: "mining_yield",
  status: "live",
  apyLow: 9.4,
  apyHigh: 12.8,
  minTicketUsdc: 250_000,
  softLockupDays: 60,
  capacityUsdc: 100_000_000,
  currentAumUsdc: 25_000_000,
  fees: { mgmtBps: 200, perfBps: 1000, hurdleBps: 600 },
  riskLevel: "low-moderate",
  spvJurisdiction: "cayman",
  shareClass: "A",
  regExemption: "regD_506c",
  disclaimers: "Not guaranteed.",
  targetMiningBps: 6000,
  targetBtcTacticalBps: 1500,
  targetUsdcBaseBps: 1500,
  targetStableReserveBps: 1000,
};

// `html` = non-workspace document layout (preserved for other flows).
// `htmlWorkspace` = the surface actually served at /vaults/[id] (LP term sheet).
// The truthful-claims guards must hold on the surface LPs really see.
const html = renderToStaticMarkup(<TermSheetPreview vault={VAULT} />);
const htmlWorkspace = renderToStaticMarkup(<TermSheetPreview vault={VAULT} workspace />);

describe("TermSheetPreview — truthful institutional claims", () => {
  it("A5 — does NOT assert 'Fireblocks MPC' custody as a verified fact", () => {
    expect(html).not.toContain("Fireblocks MPC");
    expect(html).toContain("Custody configuration pending");
  });

  it("A7 — does NOT display a hardcoded '3 of 5' that diverges from the real gate", () => {
    expect(html).not.toContain("3 of 5");
    expect(html).toContain("Multisig approval required");
  });

  it("B4 — labels the distribution cadence as indicative, not a committed schedule", () => {
    expect(html).not.toContain("Monthly · Day 1, T+5");
    expect(html).toContain("Indicative");
  });

  it("does not surface the Model B one-liner above the allocation grid (legal footer carries disclosure)", () => {
    expect(html).not.toContain(
      "Principal held in a USDC cash reserve — not deployed on-chain; yield is a monthly mining-revenue-share distribution.",
    );
  });

  it("uses vault.fees for management / performance (not share-class fallback)", () => {
    expect(html).toContain("2.00% · 10%");
    expect(html).not.toContain("1.00% · 10%");
  });

  it("fuses strategy and allocation into a single chapter", () => {
    expect(html).toContain('id="sec-strategy-allocation"');
    expect(html).toContain("Strategy &amp; allocation");
    expect(html).not.toContain('id="sec-regimes"');
  });

  it("does not repeat APY / min ticket / lock-up in At a glance (hero owns synthesis)", () => {
    expect(html).not.toContain("Target APY range");
    expect(html).not.toContain("Minimum subscription");
    expect(html).not.toContain("Soft lock-up");
  });

  it("shows vault allocation in target list only (no duplicate base regime row)", () => {
    expect(html).toContain("BTC Tactical Delta");
    expect(html).toContain(">15%<");
    expect(html).not.toContain("Vault target allocation");
  });

  it("renders regime scenarios without ct-table-surface wrapper", () => {
    expect(html).toContain("regime-scenario-table");
    expect(html).not.toContain("ct-table-surface");
    expect(html).not.toContain("overflow-x-auto");
  });

  it("uses product-doc-stack base with layout modifiers (no orphan --tight)", () => {
    expect(html).toContain("product-doc-stack product-doc-stack--tight");
    for (const match of html.matchAll(/class="([^"]*)"/g)) {
      const classValue = match[1];
      if (!classValue) continue;
      const tokens = classValue.trim().split(/\s+/);
      if (
        tokens.includes("product-doc-stack--tight") &&
        !tokens.includes("product-doc-stack")
      ) {
        throw new Error(`Orphan product-doc-stack--tight in class="${match[1]}"`);
      }
    }
  });
});

// The guards above run on the non-workspace layout, but /vaults/[id] renders the
// `workspace` branch. Re-assert the layout-independent truthful claims there so a
// regression on the surface LPs actually see cannot pass unnoticed.
describe("TermSheetPreview — workspace surface (served at /vaults/[id])", () => {
  it("A5 — custody is 'pending', never an unverified 'Fireblocks MPC' claim", () => {
    expect(htmlWorkspace).not.toContain("Fireblocks MPC");
    expect(htmlWorkspace).toContain("Custody configuration pending");
  });

  it("A7 — multisig is gated wording, not a hardcoded '3 of 5'", () => {
    expect(htmlWorkspace).not.toContain("3 of 5");
    expect(htmlWorkspace).toContain("Multisig approval required");
  });

  it("uses vault.fees for management / performance (not share-class fallback)", () => {
    expect(htmlWorkspace).toContain("2.00% · 10%");
    expect(htmlWorkspace).not.toContain("1.00% · 10%");
  });

  it("renders regime scenarios without ct-table-surface wrapper", () => {
    expect(htmlWorkspace).toContain("regime-scenario-table");
    expect(htmlWorkspace).not.toContain("ct-table-surface");
    expect(htmlWorkspace).not.toContain("overflow-x-auto");
  });

  it("carries the not-guaranteed APY disclaimer suffix", () => {
    expect(htmlWorkspace).toContain(
      "APY ranges are target projections — not guaranteed.",
    );
  });

  it("does not surface the Model B one-liner above the allocation grid (legal footer carries disclosure)", () => {
    expect(htmlWorkspace).not.toContain(
      "Principal held in a USDC cash reserve — not deployed on-chain; yield is a monthly mining-revenue-share distribution.",
    );
  });

  it("uses CardTitle (h3) module headers in workspace cards, not quiet panel labels", () => {
    expect(htmlWorkspace).toContain('class="h3 ct-text-strong ct-drop-glow-subtle"');
    expect(htmlWorkspace).toContain("Target allocation");
    expect(htmlWorkspace).not.toContain("invest-flow-detail__panel-label");
  });

  it("does not repeat step index in eyebrow or a redundant Metrics label in workspace", () => {
    expect(htmlWorkspace).not.toContain("Metrics:");
    expect(htmlWorkspace).not.toMatch(/Invest · Step [0-9] of 4/);
  });
});
