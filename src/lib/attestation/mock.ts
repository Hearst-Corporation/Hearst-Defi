import { keccak256, stringToHex } from "viem";

import { attestorAddress, signAttestation } from "./sign";
import { MOCK_ATTESTOR_PRIVATE_KEY } from "./__mocks__/mock-key";
import type { MiningAttestationPayload, SignedAttestation } from "./types";

/** Address that signs every mock attestation (derived from the Anvil test key). */
export const MOCK_ATTESTOR_ADDRESS = attestorAddress(MOCK_ATTESTOR_PRIVATE_KEY);

const PARTNER = "Cathedra Mining (Texas)";
const DAYS_PER_PERIOD = 30;
// Base figure used only to derive this mock attestation's own payload numbers.
// It does NOT drive the dashboard AUM (that comes from VaultSnapshot.aumUsdc).
const BASE_AUM_USD = 42_500_000;

/** Deterministic month index for a `"YYYY-MM"` period. */
function monthSeed(period: string): number {
  const [yStr, mStr] = period.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error(`attestation mock: bad period "${period}" (want YYYY-MM)`);
  }
  return year * 12 + (month - 1);
}

/** Smooth deterministic oscillation in [lo, hi] keyed off the month seed. */
function osc(seed: number, lo: number, hi: number, phase = 0): number {
  const t = (Math.sin(seed * 1.7 + phase) + 1) / 2;
  return lo + t * (hi - lo);
}

/** Plausible-looking, deterministic IPFS CID for a period's evidence bundle. */
function mockEvidenceCid(period: string): string {
  const h = keccak256(stringToHex(`evidence:${period}`)).slice(2);
  return `ipfs://bafybeih${h.slice(0, 52)}`;
}

/**
 * Builds a deterministic, internally-consistent mock attestation for a period:
 * revenue follows `hashrate × hashprice × days × uptime`, costs are a fraction
 * of revenue, and `minedBtc` reconciles against an assumed BTC price — so the
 * spec-05 margin formula holds. Override any field for edge-case fixtures.
 */
export function buildMockAttestation(
  period: string,
  overrides: Partial<MiningAttestationPayload> = {},
): MiningAttestationPayload {
  const seed = monthSeed(period);

  const deployedHashrateThs = round(osc(seed, 230_000, 270_000), 2);
  const uptimePct = round(osc(seed, 95, 99, 0.6), 2);
  const hashpriceUsdPerThDay = round(osc(seed, 0.045, 0.065, 1.3), 6);
  const btcPriceAssumed = osc(seed, 55_000, 75_000, 2.1);

  const revenueUsd = round(
    deployedHashrateThs * hashpriceUsdPerThDay * DAYS_PER_PERIOD * (uptimePct / 100),
    2,
  );
  const operatingCostUsd = round(revenueUsd * osc(seed, 0.4, 0.55, 3.4), 2);
  const minedBtc = round(revenueUsd / btcPriceAssumed, 8);
  const totalAumUsd = round(BASE_AUM_USD * osc(seed, 0.97, 1.03, 4.2), 2);

  return {
    version: 1,
    period,
    partner: PARTNER,
    attestor: MOCK_ATTESTOR_ADDRESS,
    deployedHashrateThs,
    uptimePct,
    hashpriceUsdPerThDay,
    minedBtc,
    revenueUsd,
    operatingCostUsd,
    totalAumUsd,
    evidenceCid: mockEvidenceCid(period),
    ...overrides,
  };
}

/** Builds and signs a mock attestation. `at` keeps `signedAt` deterministic. */
export function signMockAttestation(
  period: string,
  overrides: Partial<MiningAttestationPayload> = {},
  at?: Date,
): Promise<SignedAttestation> {
  return signAttestation(buildMockAttestation(period, overrides), MOCK_ATTESTOR_PRIVATE_KEY, {
    at: at ?? new Date(`${period}-05T09:00:00Z`),
  });
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
