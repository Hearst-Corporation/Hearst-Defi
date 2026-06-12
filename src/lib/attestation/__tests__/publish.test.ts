import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/chain/por-registry", () => ({
  publishAttestation: vi.fn(),
}));

import { publishAttestation } from "@/lib/chain/por-registry";
import {
  periodToUint,
  publishSignedAttestation,
} from "@/lib/attestation/publish";
import type { SignedAttestation } from "@/lib/attestation/types";

const FAKE_TX = `0x${"ab".repeat(32)}`;
const DIGEST = `0x${"cd".repeat(32)}`;
const ATTESTOR = `0x${"11".repeat(20)}`;

function makeSigned(): SignedAttestation {
  return {
    payload: {
      version: 1,
      period: "2026-06",
      partner: "Test Farm",
      attestor: ATTESTOR,
      deployedHashrateThs: 1000,
      uptimePct: 98.5,
      hashpriceUsdPerThDay: 0.078,
      minedBtc: 12.5,
      revenueUsd: 1_000_000,
      operatingCostUsd: 400_000,
      totalAumUsd: 25_000_000,
      evidenceCid: "bafybeievidence",
    },
    digest: DIGEST,
    signature: `0x${"ef".repeat(65)}`,
    signedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("periodToUint", () => {
  it("converts YYYY-MM to the YYYYMM uint", () => {
    expect(periodToUint("2026-06")).toBe(202606n);
    expect(periodToUint("2026-12")).toBe(202612n);
  });

  it("throws on a malformed period", () => {
    expect(() => periodToUint("2026/06")).toThrow();
    expect(() => periodToUint("26-6")).toThrow();
  });
});

describe("publishSignedAttestation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps the payload to contract base units and forwards it", async () => {
    vi.mocked(publishAttestation).mockResolvedValue(FAKE_TX);

    const result = await publishSignedAttestation(makeSigned());

    expect(result).toBe(FAKE_TX);
    expect(publishAttestation).toHaveBeenCalledOnce();
    expect(publishAttestation).toHaveBeenCalledWith({
      period: 202606n,
      totalAumUsd: 25_000_000_000_000n, // 25M USD × 1e6 (6-dp USDC)
      minedBtcSats: 1_250_000_000n, // 12.5 BTC × 1e8 (sats)
      evidenceHash: DIGEST,
      evidenceCid: "bafybeievidence",
    });
  });

  it("returns null when the publisher is disarmed (publishAttestation no-op)", async () => {
    vi.mocked(publishAttestation).mockResolvedValue(null);
    expect(await publishSignedAttestation(makeSigned())).toBeNull();
  });

  it("floors negative / non-finite figures to 0 base units", async () => {
    vi.mocked(publishAttestation).mockResolvedValue(FAKE_TX);

    const signed = makeSigned();
    signed.payload.totalAumUsd = -1;
    signed.payload.minedBtc = Number.NaN;

    await publishSignedAttestation(signed);

    expect(publishAttestation).toHaveBeenCalledWith(
      expect.objectContaining({ totalAumUsd: 0n, minedBtcSats: 0n }),
    );
  });
});
