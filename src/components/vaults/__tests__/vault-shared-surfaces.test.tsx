import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VaultAllocationAdminRows } from "@/components/vaults/vault-allocation-display";
import { VaultLegalProofRows } from "@/components/vaults/vault-legal-proof-rows";
import {
  toVaultAllocationFacts,
  toVaultLegalFacts,
} from "@/lib/vaults/vault-detail-facts";

const SOURCE = {
  strategy: "mining_yield",
  spvJurisdiction: "cayman",
  shareClass: "A",
  regExemption: "regD_506c",
  minTicketUsdc: 250_000,
  targetMiningBps: 6000,
  targetBtcTacticalBps: 1500,
  targetUsdcBaseBps: 1500,
  targetStableReserveBps: 1000,
};

describe("vault shared surfaces — admin/LP parity", () => {
  const legalFacts = toVaultLegalFacts(SOURCE);
  const allocationFacts = toVaultAllocationFacts(SOURCE);

  it("admin and investor legal rows share SPV and reg keys", () => {
    const adminHtml = renderToStaticMarkup(
      <VaultLegalProofRows facts={legalFacts} variant="admin" />,
    );
    const investorHtml = renderToStaticMarkup(
      <VaultLegalProofRows facts={legalFacts} variant="investor" />,
    );

    expect(adminHtml).toContain("Mining Yield");
    expect(adminHtml).toContain("Cayman Islands");
    expect(adminHtml).toContain("Reg D 506(c)");
    expect(adminHtml).toContain("$250,000 USDC");

    expect(investorHtml).toContain("Cayman Islands Exempted Limited Partnership");
    expect(investorHtml).toContain("Reg D, Rule 506(c)");
    expect(investorHtml).toContain("Class A");
  });

  it("admin allocation rows use the same bucket weights as LP list", () => {
    const html = renderToStaticMarkup(
      <VaultAllocationAdminRows facts={allocationFacts} />,
    );
    expect(html).toContain("60.0%");
    expect(html).toContain("15.0%");
    expect(html).toContain("Mining");
    expect(html).toContain("Stable Reserve");
  });
});
