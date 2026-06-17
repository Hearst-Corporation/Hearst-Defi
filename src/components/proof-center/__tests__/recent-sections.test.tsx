import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecentDistributions } from "@/components/proof-center/recent-distributions";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";

describe("RecentDistributions", () => {
  it("renders empty state when no rows", () => {
    const html = renderToStaticMarkup(<RecentDistributions distributions={[]} />);
    expect(html).toContain("No distributions recorded yet.");
    expect(html).toContain("ct-empty-surface--widget");
  });

  it("renders distribution rows with provenance badges", () => {
    const html = renderToStaticMarkup(
      <RecentDistributions
        distributions={[
          {
            id: "d1",
            period: "2026-05",
            amountUsdc: 1_250_000,
            recipientsCount: 12,
            distributedAt: new Date("2026-05-31T12:00:00Z"),
            txHash: "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
          },
        ]}
      />,
    );
    expect(html).toContain("Period 2026-05");
    expect(html).toContain(">Attested</span>");
  });
});

describe("ContractsAuditTrail — platform addresses", () => {
  it("renders vault/manager/custody panel when addresses supplied", () => {
    const html = renderToStaticMarkup(
      <ContractsAuditTrail
        platformAddresses={[
          {
            label: "Hearst Yield Vault (ERC-4626)",
            address: "0x1234567890123456789012345678901234567890",
            description: "Vault",
            href: "https://example.com",
          },
        ]}
      />,
    );
    expect(html).toContain("Vault, manager &amp; custody scope");
    expect(html).toContain("Hearst Yield Vault (ERC-4626)");
  });
});
