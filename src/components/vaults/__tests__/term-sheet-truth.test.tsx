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

const html = renderToStaticMarkup(<TermSheetPreview vault={VAULT} />);

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

  it("C-13 — displays the Model B one-liner verbatim on the LP surface", () => {
    expect(html).toContain(
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
});
