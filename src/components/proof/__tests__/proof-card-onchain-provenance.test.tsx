import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProofCard } from "@/components/proof/proof-card";
import type { UnifiedProof } from "@/components/proof/proof-types";

import { freshAttestation, freshEvent } from "@/components/proof-center/__tests__/fixtures";

describe("ProofCard — on-chain provenance taxonomy", () => {
  it("on-chain event card shows Live provenance (not generic On-chain badge)", () => {
    const proof: UnifiedProof = {
      source: "on-chain",
      kind: "event",
      data: freshEvent(),
    };
    const html = renderToStaticMarkup(
      <ProofCard proof={proof} onChainProvenance="live" />,
    );
    expect(html).toContain(">Live</span>");
    expect(html).not.toContain(">On-chain</span>");
  });

  it("on-chain attestation shows Stale when attestor is not allowlisted", () => {
    const proof: UnifiedProof = {
      source: "on-chain",
      kind: "attestation",
      data: freshAttestation(),
    };
    const html = renderToStaticMarkup(
      <ProofCard proof={proof} verifyAttestor={() => false} />,
    );
    expect(html).toContain(">Stale</span>");
    expect(html).not.toContain(">Attested</span>");
  });

  it("on-chain attestation shows Attested when verified", () => {
    const proof: UnifiedProof = {
      source: "on-chain",
      kind: "attestation",
      data: freshAttestation(),
    };
    const html = renderToStaticMarkup(
      <ProofCard proof={proof} verifyAttestor={() => true} />,
    );
    expect(html).toContain(">Attested</span>");
  });
});
