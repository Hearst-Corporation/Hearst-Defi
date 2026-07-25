import { readServerEnv } from "@/lib/env";

import { verifyAttestation } from "./verify";
import type {
  MiningAttestationPayload,
  SignedAttestation,
  VerificationReason,
  VerificationResult,
} from "./types";

/** The attestation-relevant columns of a persisted `Proof` row. */
export interface StoredAttestation {
  /** Canonical `MiningAttestationPayload` as JSON, or null for unsigned proofs. */
  payloadJson: string | null;
  /** keccak256 digest (the `Proof.hash` column). */
  digest: string | null;
  /** EIP-191 signature over `digest`. */
  signature: string | null;
  /** Address expected to have signed (the `Proof.signer` column). */
  signer: string | null;
}

/**
 * Extra failure modes layered on top of the pure crypto checks performed by
 * `verifyAttestation`. These are surfaced only by `verifyStoredAttestation`,
 * which has access to the runtime allowlist (env-configured).
 */
export type StoredVerificationReason =
  | VerificationReason
  | "signer_not_allowlisted"
  | "no_allowlist_configured";

export interface StoredVerificationResult {
  valid: boolean;
  recovered: `0x${string}` | null;
  reason: StoredVerificationReason;
}

/**
 * Narrowing parse of a stored payload — avoids `any` from `JSON.parse` and
 * guards every field the canonical encoder reads, so a malformed row fails
 * verification rather than throwing.
 */
export function parseAttestationPayload(
  json: string,
): MiningAttestationPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const ok =
    o.version === 1 &&
    typeof o.period === "string" &&
    typeof o.partner === "string" &&
    typeof o.attestor === "string" &&
    o.attestor.startsWith("0x") &&
    typeof o.deployedHashrateThs === "number" &&
    typeof o.uptimePct === "number" &&
    typeof o.hashpriceUsdPerThDay === "number" &&
    typeof o.minedBtc === "number" &&
    typeof o.revenueUsd === "number" &&
    typeof o.operatingCostUsd === "number" &&
    typeof o.totalAumUsd === "number" &&
    typeof o.evidenceCid === "string";
  if (!ok) return null;
  return {
    version: 1,
    period: o.period as string,
    partner: o.partner as string,
    attestor: o.attestor as `0x${string}`,
    deployedHashrateThs: o.deployedHashrateThs as number,
    uptimePct: o.uptimePct as number,
    hashpriceUsdPerThDay: o.hashpriceUsdPerThDay as number,
    minedBtc: o.minedBtc as number,
    revenueUsd: o.revenueUsd as number,
    operatingCostUsd: o.operatingCostUsd as number,
    totalAumUsd: o.totalAumUsd as number,
    evidenceCid: o.evidenceCid as string,
  };
}

/**
 * Parses `ATTESTATION_ALLOWED_SIGNERS` (comma-separated 0x addresses) into a
 * lower-cased `Set`. Empty / unset / whitespace-only → empty set.
 *
 * The value is read LIVE on every call via `readServerEnv` (rather than the
 * validated `env` singleton, which freezes its values at boot) so tests and
 * admin tooling can mutate the allowlist at runtime without a process
 * restart. The Zod schema in `src/lib/env.ts` still validates the variable
 * shape at boot — the canon helper just keeps the read live.
 */
function loadAllowlist(): Set<string> {
  const raw = readServerEnv("ATTESTATION_ALLOWED_SIGNERS");
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim().toLowerCase();
    if (trimmed.startsWith("0x") && trimmed.length === 42) {
      out.add(trimmed);
    }
  }
  return out;
}

/** True when the dev escape hatch is active. Disabled in production. */
function devAcceptAny(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return readServerEnv("ATTESTATION_DEV_ACCEPT_ANY") === "1";
}

/**
 * True when `signer` is a trusted attestor: present in the env allowlist
 * (`ATTESTATION_ALLOWED_SIGNERS`), or accepted via the dev bypass. Fail-closed:
 * an unset allowlist returns `false` (never fail-open). Used by the Proof
 * Center to gate the "Attested" badge on an on-chain attestation — the
 * attestor must be allowlisted, not merely fresh (A4).
 */
export function isAttestorAllowlisted(signer: string | null | undefined): boolean {
  if (!signer) return false;
  if (devAcceptAny()) return true;
  return loadAllowlist().has(signer.toLowerCase());
}

/**
 * Verifies an attestation reconstructed from DB columns.
 *
 * Returns `null` for proofs that carry no signature (custody/audit/methodology),
 * otherwise a {@link StoredVerificationResult}. Checks are performed in this
 * order, and the first failure short-circuits with a precise `reason`:
 *
 *   1. ECDSA signature is well-formed (recovers an address).
 *   2. Recovered signer ∈ allowlist (env `ATTESTATION_ALLOWED_SIGNERS`) —
 *      unless the dev bypass `ATTESTATION_DEV_ACCEPT_ANY=1` is active AND we
 *      are NOT running in production. In production with no allowlist
 *      configured, verification is **fail-closed**
 *      (`reason: "no_allowlist_configured"`) — a missing allowlist must never
 *      silently accept arbitrary signers.
 *   3. Digest matches the canonical encoding of the persisted payload, and
 *      the stored `signer` column matches the recovered address.
 */
export async function verifyStoredAttestation(
  row: StoredAttestation,
): Promise<StoredVerificationResult | null> {
  if (!row.payloadJson || !row.digest || !row.signature || !row.signer) {
    return null;
  }

  const payload = parseAttestationPayload(row.payloadJson);
  if (payload === null) {
    return { valid: false, recovered: null, reason: "digest_mismatch" };
  }

  const signed: SignedAttestation = {
    payload,
    digest: row.digest as `0x${string}`,
    signature: row.signature as `0x${string}`,
    signedAt: new Date(0).toISOString(), // not part of verification
  };

  const cryptoResult: VerificationResult = await verifyAttestation(signed);

  // (a) Signature must be recoverable. `digest_mismatch` and `bad_signature`
  // and `signer_mismatch` all fail at this stage. We surface them as-is.
  if (!cryptoResult.valid) {
    return {
      valid: false,
      recovered: cryptoResult.recovered,
      reason: cryptoResult.reason,
    };
  }

  // (b) Recovered signer must be in the allowlist (or dev bypass active).
  const recovered = cryptoResult.recovered;
  if (recovered === null) {
    // Defensive: a valid result always has a recovered address. If not,
    // treat as a bad signature.
    return { valid: false, recovered: null, reason: "bad_signature" };
  }

  if (!devAcceptAny()) {
    const allowlist = loadAllowlist();
    if (allowlist.size === 0) {
      // Fail-closed: no allowlist configured → reject every signed proof.
      return {
        valid: false,
        recovered,
        reason: "no_allowlist_configured",
      };
    }
    if (!allowlist.has(recovered.toLowerCase())) {
      return {
        valid: false,
        recovered,
        reason: "signer_not_allowlisted",
      };
    }
  }

  // (c) Stored signer column must match the recovered address. (digest already
  // validated by `verifyAttestation`.)
  if (recovered.toLowerCase() !== row.signer.toLowerCase()) {
    return { valid: false, recovered, reason: "signer_mismatch" };
  }

  return { valid: true, recovered, reason: "ok" };
}
