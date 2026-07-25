/**
 * /admin/proofs signature column honesty (E5 — Z3 "deux vérités").
 *
 * The library now runs the SAME verification as proof-center/full
 * (verifyStoredAttestation). Lock the label mapping: "no signature" is an em
 * dash — it is neither "verified" nor "unverified", and nothing may ever
 * upgrade an absent or failed verification to "verified".
 */

import { describe, expect, it, vi } from "vitest";

// proof-list is a client component whose import chain reaches the server
// action module (prisma). The action is irrelevant to the pure label.
vi.mock("@/app/admin/proofs/actions", () => ({
  deleteProof: vi.fn(),
}));

import { signatureLabel } from "@/components/admin/proof-list";

describe("signatureLabel", () => {
  it("verified → 'verified'", () => {
    expect(signatureLabel(true)).toBe("verified");
  });

  it("failed verification → 'unverified'", () => {
    expect(signatureLabel(false)).toBe("unverified");
  });

  it("no signature (null/undefined) → em dash, never a verdict", () => {
    expect(signatureLabel(null)).toBe("—");
    expect(signatureLabel(undefined)).toBe("—");
  });
});
