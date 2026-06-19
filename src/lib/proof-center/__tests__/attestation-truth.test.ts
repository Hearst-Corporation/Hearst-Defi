import { describe, expect, it, vi } from "vitest";

import type { OnChainAttestation } from "@/lib/chain/por-registry";
import { latestAttestationVerified } from "@/lib/proof-center/attestation-truth";

vi.mock("@/lib/attestation/stored", () => ({
  isAttestorAllowlisted: vi.fn((signer: string) => signer === "0xallowed"),
}));

function attestation(attestor: `0x${string}`): OnChainAttestation {
  return {
    attestationId: 1n,
    period: 202601n,
    attestor,
    totalAumUsd: 1_000_000,
    minedBtc: 0.5,
    rawTotalAumUsd: 1_000_000_000_000n,
    rawMinedBtcSats: 50_000_000n,
    evidenceHash: "0xabc",
    evidenceCid: "bafy",
    timestamp: new Date("2026-01-01"),
    txHash: "0xdef",
    blockNumber: 100n,
  };
}

describe("latestAttestationVerified", () => {
  it("is false when attestations are empty", () => {
    expect(latestAttestationVerified([])).toBe(false);
  });

  it("is false when latest attestor is not allowlisted", () => {
    expect(
      latestAttestationVerified([attestation("0xdenied")]),
    ).toBe(false);
  });

  it("is true when latest attestor is allowlisted", () => {
    expect(
      latestAttestationVerified([attestation("0xallowed")]),
    ).toBe(true);
  });

  it("only evaluates the first (latest) attestation", () => {
    expect(
      latestAttestationVerified([
        attestation("0xdenied"),
        attestation("0xallowed"),
      ]),
    ).toBe(false);
  });
});
