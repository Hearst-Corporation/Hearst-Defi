import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DepositSummary } from "@/components/vaults/deposit-summary";
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

describe("DepositSummary — vault panel DS patterns", () => {
  it("renders a bento panel and estimated provenance", () => {
    const html = renderToStaticMarkup(
      <DepositSummary vault={VAULT} amount={250_000} />,
    );

    // Bento panel chrome (Portfolio canon), not the legacy vault-panel DS.
    expect(html).toContain("rounded-2xl");
    expect(html).toContain("bg-surface-card");
    expect(html).not.toContain("vault-panel-header");
    expect(html).toContain("Deposit Summary");
    expect(html).toContain("Data provenance: Estimated");
  });

  it("renders APY as a range and the graphical principal/yield split", () => {
    const html = renderToStaticMarkup(
      <DepositSummary vault={VAULT} amount={500_000} />,
    );

    // Graphical split on a graphite track. The projected total + principal
    // segment are NEUTRAL (--ct-text-faint) — this is an ESTIMATED projection,
    // and green + heartbeat are reserved for genuinely-Live values only. The
    // yield segment keeps a muted accent tint so the two stay distinguishable.
    expect(html).toContain("bg-[var(--ct-text-faint)]");
    expect(html).toContain("color-mix(in_srgb,var(--ct-accent)_40%,transparent)");
    // The projected-total headline is neutral (not full-green) on estimated data.
    expect(html).toContain("text-[var(--ct-text-strong)]");
    expect(html).toContain("9.4");
    expect(html).toContain("12.8");
    // Principal is a fact, not a projection — it stays a single figure.
    expect(html).toContain("$500,000 USDC");
  });

  it("shows placeholder dashes when amount is zero", () => {
    const html = renderToStaticMarkup(<DepositSummary vault={VAULT} amount={0} />);

    expect(html).toContain("ct-text-muted");
    expect(html).toContain("Methodology v3.0");
  });

  // ── Non-negotiable #1: no single-point money figure derived from the band
  //    midpoint. Every projected money value must be published as a RANGE. ──
  it("publishes the projected total and accumulation as ranges, never a point", () => {
    const html = renderToStaticMarkup(
      <DepositSummary vault={VAULT} amount={500_000} />,
    );

    // Headline is a band (low–high USDC), derived from apyLow/apyHigh, not a
    // single mid-derived figure.
    expect(html).toContain("$602,975–$645,001 USDC");
    // Accumulation legend is a band too.
    expect(html).toContain("~$102,975–$145,001");

    // The retired single-point figures must be gone: no mid-derived yearly cash
    // yield ("~$52,700"-style), no "Est. gross yield (p.a.)" tile, and no
    // soft-close anchoring. A money amount immediately followed by "USDC" with
    // NO en-dash range separator before it would be a single-point publish.
    expect(html).not.toContain("Est. gross yield (p.a.)");
    expect(html).not.toContain("soft close");
    expect(html).not.toContain("Projected at soft close");
    // Old mid-derived p.a. figure for this vault (~11.1% × 500k) must not appear.
    expect(html).not.toContain("~$55,500");
  });

  it("anchors delivery on the 24-month maturity, not the 60-day soft close", () => {
    const html = renderToStaticMarkup(
      <DepositSummary vault={VAULT} amount={500_000} />,
    );

    // Re-anchored on the term (v3.0 §2): BTC delivered at maturity, no periodic
    // distribution, soft lock-up is not a realisation date.
    expect(html).toContain("24 months");
    expect(html).toContain("delivered at maturity");
    expect(html).toContain("no periodic cash distribution");
    expect(html).toContain("not a realisation date");
  });

  it("keeps no forbidden vocabulary in the rendered surface", () => {
    const html = renderToStaticMarkup(
      <DepositSummary vault={VAULT} amount={500_000} />,
    );
    for (const word of [
      "guarantee",
      "promise",
      "certain",
      "will deliver",
      "risk-free",
    ]) {
      // "not guaranteed" is explicitly permitted (v3.0 §9) — check the bare
      // forbidden stems don't appear except inside that allowed phrase.
      const stripped = html.replace(/not guaranteed/gi, "");
      expect(stripped.toLowerCase()).not.toContain(word);
    }
  });
});
