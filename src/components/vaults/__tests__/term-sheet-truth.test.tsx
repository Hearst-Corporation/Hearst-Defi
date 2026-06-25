import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TermSheetPreview } from "@/components/vaults/term-sheet-preview";
import type { VaultProduct } from "@/lib/data/vaults";

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

describe("TermSheetPreview — LP term sheet (/vaults/[id])", () => {
  it("A5 — custody is pending, never an unverified Fireblocks MPC claim", () => {
    expect(html).not.toContain("Fireblocks MPC");
    expect(html).toContain("Custody configuration pending");
  });

  it("A7 — multisig is gated wording, not a hardcoded 3 of 5", () => {
    expect(html).not.toContain("3 of 5");
    expect(html).toContain("Multisig approval required");
  });

  it("uses vault.fees for management / performance (not share-class fallback)", () => {
    expect(html).toContain("2.00% · 10%");
    expect(html).not.toContain("1.00% · 10%");
  });

  it("renders regime scenarios without ct-table-surface wrapper", () => {
    expect(html).toContain("regime-scenario-table");
    expect(html).not.toContain("ct-table-surface");
    expect(html).not.toContain("overflow-x-auto");
  });

  it("carries the not-guaranteed APY disclaimer suffix", () => {
    expect(html).toContain("APY ranges are target projections — not guaranteed.");
  });

  it("does not surface the Model B one-liner above the allocation grid", () => {
    expect(html).not.toContain(
      "Principal held in a USDC cash reserve — not deployed on-chain; yield is a monthly mining-revenue-share distribution.",
    );
  });

  it("uses doc-flow h2 section headers, not quiet panel labels", () => {
    expect(html).toContain('class="h2"');
    expect(html).toContain("Target allocation");
    expect(html).toContain("Regime scenarios");
    expect(html).toContain("Vault metrics");
    expect(html).not.toContain("invest-flow-detail__panel-label");
    expect(html).not.toContain('class="h3 ct-text-strong ct-drop-glow-subtle"');
  });

  it("does not repeat step index in eyebrow or a redundant Metrics label", () => {
    expect(html).not.toContain("Metrics:");
    expect(html).not.toMatch(/Invest · Step [0-9] of 4/);
  });

  it("shows vault allocation in target list only (no duplicate base regime row)", () => {
    expect(html).toContain("BTC Tactical Delta");
    expect(html).toContain(">15%<");
    expect(html).not.toContain("Vault target allocation");
  });
});
