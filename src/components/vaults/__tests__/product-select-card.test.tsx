import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductSelectCard } from "@/components/vaults/product-select-card";
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

describe("ProductSelectCard — DS layout + provenance", () => {
  it("renders strategy label visibly, the APY provenance badge, and status", () => {
    const html = renderToStaticMarkup(<ProductSelectCard vault={VAULT} />);

    expect(html).toContain("Mining Yield");
    expect(html).toContain(">Estimated</span>");
    expect(html).toContain(">Live</span>");
  });

  it("uses container-query card classes with flat term rows — no md: width breakpoints", () => {
    const html = renderToStaticMarkup(<ProductSelectCard vault={VAULT} />);

    expect(html).toContain("vault-select-card");
    expect(html).toContain("vault-select-card__main");
    expect(html).toContain("vault-select-card__meta");
    expect(html).toContain("vault-select-card__terms");
    expect(html).toContain("vault-select-card__term-row");
    expect(html).not.toMatch(/md:(flex|w|hidden|block|gap)/);
  });

  it("renders APY as a range", () => {
    const html = renderToStaticMarkup(<ProductSelectCard vault={VAULT} />);

    expect(html).toContain("9.4");
    expect(html).toContain("12.8");
  });

  it("links live vaults to detail page", () => {
    const html = renderToStaticMarkup(<ProductSelectCard vault={VAULT} />);

    expect(html).toContain('href="/vaults/hyv-a"');
    expect(html).toContain("View details");
  });
});
