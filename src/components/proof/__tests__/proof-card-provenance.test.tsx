/**
 * ProofCard — Admin Honesty contract for off-chain ("paper") proofs.
 *
 * Guards:
 *  - Off-chain proofs carry a VISIBLE provenance badge (never an unlabelled card).
 *  - The end-to-end signature verification result is NOT silently dropped:
 *      verified  → "attested" provenance + "Verified" row
 *      failed    → "manual" provenance + "Failed" row (not hidden)
 *      none/null → "manual" provenance, no signature row claimed
 *
 * renderToStaticMarkup (node env, no jsdom).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProofCard } from "@/components/proof/proof-card";
import type { UnifiedProof } from "@/components/proof/proof-types";

function paperProof(
  overrides: Partial<Extract<UnifiedProof, { source: "paper" }>>,
): UnifiedProof {
  return {
    source: "paper",
    id: "p1",
    proofType: "mining_attestation",
    period: "2026-05",
    title: "May mining attestation",
    hash: "0x1234567890abcdef1234567890abcdef12345678",
    uri: "https://example.com/proof.pdf",
    postedAt: "2026-05-31T00:00:00Z",
    postedBy: "operator",
    txHash: null,
    signer: "0xabc",
    attestationVerified: null,
    ...overrides,
  };
}

describe("ProofCard — off-chain provenance honesty", () => {
  it("verified signature → Attested provenance + Verified row", () => {
    const html = renderToStaticMarkup(
      <ProofCard proof={paperProof({ attestationVerified: true })} />,
    );
    expect(html).toContain("Attested");
    expect(html).toContain("Verified");
    expect(html).not.toContain("Failed");
  });

  it("failed signature is surfaced, not dropped (Failed row + Manual provenance)", () => {
    const html = renderToStaticMarkup(
      <ProofCard proof={paperProof({ attestationVerified: false })} />,
    );
    expect(html).toContain("Failed");
    expect(html).toContain("Manual");
    // Must not falsely claim the proof is attested when its signature failed.
    expect(html).not.toContain("Attested");
  });

  it("no signature → Manual provenance, no signature claim", () => {
    const html = renderToStaticMarkup(
      <ProofCard proof={paperProof({ attestationVerified: null })} />,
    );
    expect(html).toContain("Manual");
    expect(html).not.toContain("Verified");
    expect(html).not.toContain("Attested");
  });
});
