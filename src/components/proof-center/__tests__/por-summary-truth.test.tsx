import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PorSummary } from "@/components/proof-center/por-summary";
import type { OnChainAttestation } from "@/lib/chain/por-registry";

// A4 — the "Attested" badge must require a verified, allowlisted signer, not
// just a fresh (<24h) timestamp.

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
    timestamp: new Date(), // fresh
    txHash: "0xdef",
    blockNumber: 123n,
  };
}

// The ProvenanceBadge renders visible label text (Tooltip replaced title=).
const ATTESTED_BADGE = ">Attested</span>";
const STALE_BADGE = ">Stale</span>";

/** Badge in the PoR card header sits before the KPI grid. */
function headerProvenanceBadge(html: string): string {
  const headerEnd = html.indexOf("ct-nested-kpi-grid");
  return headerEnd === -1 ? html : html.slice(0, headerEnd);
}

describe("PorSummary — Attested requires verification (A4)", () => {
  it("shows Stale (not Attested) for a fresh but UNVERIFIED attestation", () => {
    const html = renderToStaticMarkup(
      <PorSummary attestation={freshAttestation()} verified={false} />,
    );
    const header = headerProvenanceBadge(html);
    expect(header).toContain(STALE_BADGE);
    expect(header).not.toContain(ATTESTED_BADGE);
    expect(html).toContain("not yet verified against the allowlist");
  });

  it("defaults to Stale when the verified flag is omitted (fail-closed)", () => {
    const html = renderToStaticMarkup(
      <PorSummary attestation={freshAttestation()} />,
    );
    const header = headerProvenanceBadge(html);
    expect(header).toContain(STALE_BADGE);
    expect(header).not.toContain(ATTESTED_BADGE);
  });

  it("shows Attested only when fresh AND verified", () => {
    const html = renderToStaticMarkup(
      <PorSummary attestation={freshAttestation()} verified={true} />,
    );
    const header = headerProvenanceBadge(html);
    expect(header).toContain(ATTESTED_BADGE);
    expect(header).not.toContain(STALE_BADGE);
  });
});
