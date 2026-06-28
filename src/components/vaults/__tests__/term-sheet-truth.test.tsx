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

  it("renders regime scenarios in a bento panel, not the ct-table-surface DS", () => {
    // The regime table is present (section heading) inside a bento panel.
    expect(html).toContain("Regime Scenarios");
    expect(html).not.toContain("ct-table-surface");
    expect(html).toContain("rounded-2xl");
  });

  it("carries the not-guaranteed APY disclaimer suffix", () => {
    expect(html).toContain("APY ranges are target projections — not guaranteed.");
  });

  it("does not surface the Model B one-liner above the allocation grid", () => {
    expect(html).not.toContain(
      "Principal held in a USDC cash reserve — not deployed on-chain; yield is a monthly mining-revenue-share distribution.",
    );
  });

  it("uses bento <h2> section headers, not quiet panel labels", () => {
    // Bento section headers (Portfolio canon <h2>), with the canonical sections.
    expect(html).toMatch(/<h2[^>]*>[^<]*Target Allocation/i);
    expect(html).toContain("Target Allocation");
    expect(html).toContain("Regime Scenarios");
    expect(html).toContain("Vault Metrics");
    expect(html).not.toContain("invest-flow-detail__panel-label");
    expect(html).not.toContain('class="h3 ct-text-strong ct-drop-glow-subtle"');
  });

  it("does not repeat step index in eyebrow or a redundant Metrics label", () => {
    expect(html).not.toContain("Metrics:");
    expect(html).not.toMatch(/Invest · Step [0-9] of 4/);
  });

  it("uses vault product primitives in legal section (not proof-center rows)", () => {
    // VaultDetailRow now renders as a bento proof row (border-b py-3 / tabular-nums)
    // instead of the legacy .vault-panel-row chrome.
    expect(html).toContain("border-b border-[var(--ct-border-soft)] py-3");
    // Type size is the --ct-text-xs token (13px) now, not the raw arbitrary class.
    expect(html).toContain(
      "text-[length:var(--ct-text-xs)] font-medium text-white tabular-nums",
    );
    expect(html).not.toContain("ct-proof-row");
  });

  it("uses product provenance compact class, not dashboard grammar", () => {
    expect(html).toContain("provenance-badge--compact");
    expect(html).not.toContain("dashboard-provenance-badge--compact");
  });
});
