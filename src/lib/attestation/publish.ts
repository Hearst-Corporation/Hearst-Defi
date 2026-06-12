import "server-only";

import { publishAttestation } from "@/lib/chain/por-registry";

import type { SignedAttestation } from "./types";

// On-chain base-unit conventions — must mirror the READ side in
// src/lib/chain/por-registry.ts (`fromBaseUnits(totalAumUsd, 6)` and
// `fromBaseUnits(minedBtcSats, 8)`), so a value written here round-trips on read.
const USDC_DECIMALS = 6n;
const BTC_DECIMALS = 8n;

/** Canonical `"YYYY-MM"` reporting period → the contract's `uint64` `YYYYMM`. */
export function periodToUint(period: string): bigint {
  const digits = period.replace("-", "");
  if (!/^\d{6}$/.test(digits)) {
    throw new Error(
      `Invalid attestation period "${period}" — expected "YYYY-MM".`,
    );
  }
  return BigInt(digits);
}

/** Scale a non-negative decimal to integer base units (rounded) as `bigint`. */
function toBaseUnits(value: number, decimals: bigint): bigint {
  if (!Number.isFinite(value) || value < 0) return 0n;
  return BigInt(Math.round(value * Number(10n ** decimals)));
}

/**
 * Publishes a signed mining attestation to the on-chain PoRRegistry.
 *
 * Bridges the human `MiningAttestationPayload` to the contract's base units:
 * AUM → 6-dp USDC, mined BTC → sats (8-dp), period `"YYYY-MM"` → `YYYYMM`, and
 * `evidenceHash` = the signed `digest` (keccak256 of the canonical encoding).
 *
 * Gated/disarmed-safe: `publishAttestation` returns `null` when the publisher
 * key (`HEARST_PUBLISHER_PRIVATE_KEY`) or the PoRRegistry address is unset, so
 * this never throws and writes nothing until the publisher is armed. Base
 * Sepolia testnet only.
 */
export async function publishSignedAttestation(
  signed: SignedAttestation,
): Promise<`0x${string}` | null> {
  const { payload, digest } = signed;
  return publishAttestation({
    period: periodToUint(payload.period),
    totalAumUsd: toBaseUnits(payload.totalAumUsd, USDC_DECIMALS),
    minedBtcSats: toBaseUnits(payload.minedBtc, BTC_DECIMALS),
    evidenceHash: digest,
    evidenceCid: payload.evidenceCid,
  });
}
