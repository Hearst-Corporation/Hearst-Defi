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
  it("uses vault-panel-header/body chrome and estimated provenance", () => {
    const html = renderToStaticMarkup(
      <DepositSummary vault={VAULT} amount={250_000} />,
    );

    expect(html).toContain("vault-panel-header");
    expect(html).toContain("vault-panel-body");
    expect(html).toContain("Deposit summary");
    expect(html).toContain(">Estimated</span>");
  });

  it("renders APY as a range and ct-proof-row rows", () => {
    const html = renderToStaticMarkup(
      <DepositSummary vault={VAULT} amount={500_000} />,
    );

    expect(html).toContain("ct-proof-row");
    expect(html).toContain("9.4");
    expect(html).toContain("12.8");
    expect(html).toContain("$500,000 USDC");
  });

  it("shows placeholder dashes when amount is zero", () => {
    const html = renderToStaticMarkup(<DepositSummary vault={VAULT} amount={0} />);

    expect(html).toContain("ct-text-muted");
    expect(html).toContain("Methodology v1.0");
  });
});
