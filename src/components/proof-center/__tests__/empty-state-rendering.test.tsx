/**
 * Proof Center empty-state rendering — structural contract (DS §9).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventTimeline } from "@/components/proof-center/event-timeline";
import { PorSummary } from "@/components/proof-center/por-summary";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { CustodySnapshot } from "@/lib/data/custody";

function assertModuleEmptyContract(html: string, message: string): void {
  expect(html).toContain(message);
  expect(html).toContain("ct-empty-surface--widget");
  expect(html).not.toContain("glass-panel");
  expect(html).not.toContain("ct-system-panel");
  expect(html).not.toContain("border-dashed");
  expect(html).not.toContain("Stale");
}

function freshAttestation(): OnChainAttestation {
  return {
    attestationId: 1n,
    period: 202605n,
    attestor: "0x1111111111111111111111111111111111111111",
    totalAumUsd: 25_000_000,
    minedBtc: 12.3456,
    rawTotalAumUsd: 25_000_000_000_000n,
    rawMinedBtcSats: 1_234_560_000n,
    evidenceHash: "0xabc",
    evidenceCid: "ipfs://QmTest",
    timestamp: new Date(),
    txHash: "0xdef",
    blockNumber: 123n,
  };
}

function zeroReservesCustody(): CustodySnapshot {
  return {
    provenance: "manual",
    configured: false,
    asOf: new Date().toISOString(),
    accountsCount: 0,
    totalUsdcReserves: 0,
    accounts: [],
  };
}

describe("Proof Center empty states — design contract", () => {
  it("PorSummary: no attestation → widget empty, no active card shell", () => {
    const html = renderToStaticMarkup(<PorSummary attestation={null} />);
    assertModuleEmptyContract(
      html,
      "No on-chain Proof of Reserves attestation yet.",
    );
  });

  it("EventTimeline: no events → widget empty, no active card shell", () => {
    const html = renderToStaticMarkup(<EventTimeline events={[]} />);
    assertModuleEmptyContract(html, "No on-chain events yet.");
  });

  it("PorSummary: nested custody empty uses inline variant inside active card", () => {
    const html = renderToStaticMarkup(
      <PorSummary attestation={freshAttestation()} custody={zeroReservesCustody()} />,
    );
    expect(html).toContain("glass-panel");
    expect(html).toContain("ct-empty-surface--inline");
    expect(html).toContain(
      "Custody reserves will appear after the first verified Fireblocks snapshot.",
    );
    expect(html).not.toContain("ct-empty-surface--widget");
  });
});
